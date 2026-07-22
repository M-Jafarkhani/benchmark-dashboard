from __future__ import annotations

import json
import re
import tempfile
import time
from concurrent.futures import ThreadPoolExecutor
from functools import lru_cache
from pathlib import Path
from threading import Lock
from typing import Any
from urllib.request import Request, urlopen

from dotenv import dotenv_values
from rdflib import Graph, Namespace
from rdflib.namespace import RDF, RDFS

CONFIG = dotenv_values(Path(__file__).resolve().parent.parent / ".env")

ZBMATH_API = "https://api.zbmath.org/v1/software"
CACHE_SECONDS = 300

RUNS_QUERY = """
PREFIX schemas: <https://schema.org/>
PREFIX schema: <http://schema.org/>
PREFIX m4i: <http://w3id.org/nfdi4ing/metadata4ing#>
PREFIX prov: <http://www.w3.org/ns/prov#>

SELECT DISTINCT ?run_id ?benchmark_url ?benchmark_repo ?software_url ?datePublished
WHERE {
    ?run_id m4i:investigates ?benchmark_repo .
    ?run_id prov:used ?software_url .
    ?benchmark_url schemas:codeRepository ?benchmark_repo .
    ?run_id schema:datePublished ?datePublished .
}
"""

_cache: tuple[float, list[dict[str, Any]]] | None = None
_cache_lock = Lock()

M4I = Namespace("http://w3id.org/nfdi4ing/metadata4ing#")
BFO_HAS_PART = Namespace("http://purl.obolibrary.org/obo/")["BFO_0000051"]


class UpstreamError(RuntimeError):
    pass


def _fetch_json(url: str) -> Any:
    request = Request(
        url,
        headers={"Accept": "application/sparql-results+json, application/json"},
    )
    try:
        with urlopen(request, timeout=20) as response:
            return json.load(response)
    except Exception as error:
        raise UpstreamError(f"Could not load data from {url.split('?')[0]}") from error


@lru_cache(maxsize=1)
def _query_sparql():
    """Configure and return semantic-benchmark's production query helper."""
    from semantic_benchmark.rohub import configure_rohub, query_sparql

    configure_rohub(use_production_rohub=True)
    return query_sparql


def _sparql(query: str) -> list[dict[str, str | None]]:
    try:
        frame = _query_sparql()(query)
        return frame.to_dict(orient="records")
    except Exception as error:
        raise UpstreamError("Could not query the production RoHub endpoint") from error


def _software_name(url: str) -> str:
    match = re.search(r"/software/(\d+)(?:/)?$", url)
    if not match:
        return url.rstrip("/").rsplit("/", 1)[-1]
    payload = _fetch_json(f"{ZBMATH_API}/{match.group(1)}")
    return payload["result"]["name"]


def _graph_query(run_ids: list[str]) -> str:
    values = " ".join(f"<{run_id}>" for run_id in run_ids)
    return f"""
PREFIX schema: <http://schema.org/>
SELECT ?run_id ?graph
WHERE {{
  VALUES ?run_id {{ {values} }}
  GRAPH ?graph {{ ?run_id a schema:Dataset . }}
}}
"""


def _benchmark_uuid(benchmark_url: str) -> str:
    """Return the research-object UUID from the URL used by RoHub."""
    identifier = benchmark_url.rstrip("/").rsplit("/", 1)[-1]
    if not re.fullmatch(
        r"[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}",
        identifier,
    ):
        raise UpstreamError(f"Invalid benchmark RoHub URL: {benchmark_url}")
    return identifier


def _download_benchmark_graph(benchmark_url: str) -> Graph:
    """Download and parse the benchmark's Annotation Collection JSON-LD."""
    username = CONFIG.get("ROHUB_USERNAME")
    password = CONFIG.get("ROHUB_PASSWORD")
    if not username or not password:
        raise UpstreamError(
            "ROHUB_USERNAME and ROHUB_PASSWORD are required to load benchmark metadata"
        )

    from semantic_benchmark.rohub import download_benchmark_resources

    identifier = _benchmark_uuid(benchmark_url)
    try:
        with tempfile.TemporaryDirectory(prefix="benchmark-metadata-") as directory:
            destination = f"{directory}/{identifier}.json"
            download_benchmark_resources(
                identifier,
                username=username,
                password=password,
                semantic_resource_filename=destination,
                use_production_rohub=True,
            )
            return Graph().parse(destination, format="json-ld")
    except UpstreamError:
        raise
    except Exception as error:
        raise UpstreamError(
            f"Could not download metadata for benchmark {identifier}"
        ) from error


def _labels(graph: Graph, subjects) -> list[str]:
    return sorted(
        {str(label) for subject in subjects for label in graph.objects(subject, RDFS.label)},
        key=str.casefold,
    )


def _benchmark_metadata(benchmark_url: str) -> dict[str, str | list[str]]:
    """Extract the same benchmark, parameter, and metric fields as the notebook."""
    graph = _download_benchmark_graph(benchmark_url)
    benchmarks = list(graph.subjects(RDF.type, M4I.Benchmark))
    names = _labels(graph, benchmarks)
    parameters = _labels(
        graph,
        (
            parameter
            for benchmark in benchmarks
            for parameter_set in graph.objects(benchmark, M4I.hasParameterSet)
            for parameter in graph.objects(parameter_set, BFO_HAS_PART)
        ),
    )
    metrics = _labels(
        graph,
        (
            metric
            for benchmark in benchmarks
            for metric in graph.objects(benchmark, M4I.evaluates)
        ),
    )
    return {
        "benchmark": names[0] if names else "",
        "parameters": parameters,
        "metrics": metrics,
    }


def load_runs(*, force: bool = False) -> list[dict[str, Any]]:
    """Reproduce the notebook dataframe immediately after software_url is dropped."""
    global _cache
    with _cache_lock:
        if not force and _cache and time.monotonic() - _cache[0] < CACHE_SECONDS:
            return _cache[1]

        rows = _sparql(RUNS_QUERY)
        run_ids = [row["run_id"] for row in rows if row.get("run_id")]
        graphs = _sparql(_graph_query(run_ids)) if run_ids else []
        graph_by_run = {row["run_id"]: row.get("graph") for row in graphs}

        software_urls = sorted({row["software_url"] for row in rows if row.get("software_url")})
        with ThreadPoolExecutor(max_workers=min(8, len(software_urls) or 1)) as pool:
            names = dict(zip(software_urls, pool.map(_software_name, software_urls)))

        benchmark_urls = sorted({row["benchmark_url"] for row in rows if row.get("benchmark_url")})
        # RoHub authentication is process-global, so mirror the notebook's
        # sequential downloads instead of logging in from concurrent threads.
        benchmark_metadata = {
            url: _benchmark_metadata(url) for url in benchmark_urls
        }

        result = [
            {
                "run_id": row.get("run_id"),
                "benchmark_url": row.get("benchmark_url"),
                "benchmark_repo": row.get("benchmark_repo"),
                "graph": graph_by_run.get(row.get("run_id")),
                "software_name": names.get(row.get("software_url")),
                "software_url": row.get("software_url"),
                "datePublished": row.get("datePublished"),
                **benchmark_metadata.get(
                    row.get("benchmark_url"),
                    {"benchmark": "", "parameters": [], "metrics": []},
                ),
            }
            for row in rows
        ]
        result.sort(key=lambda row: (row["benchmark_repo"] or "", row["software_name"] or ""))
        _cache = (time.monotonic(), result)
        return result
