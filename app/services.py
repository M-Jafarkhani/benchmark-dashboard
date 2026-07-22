from __future__ import annotations

import json
import re
import time
from concurrent.futures import ThreadPoolExecutor
from functools import lru_cache
from threading import Lock
from typing import Any
from urllib.request import Request, urlopen

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

_cache: tuple[float, list[dict[str, str | None]]] | None = None
_cache_lock = Lock()


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


def load_runs(*, force: bool = False) -> list[dict[str, str | None]]:
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

        result = [
            {
                "run_id": row.get("run_id"),
                "benchmark_url": row.get("benchmark_url"),
                "benchmark_repo": row.get("benchmark_repo"),
                "graph": graph_by_run.get(row.get("run_id")),
                "software_name": names.get(row.get("software_url")),
                "software_url": row.get("software_url"),
                "datePublished": row.get("datePublished"),
            }
            for row in rows
        ]
        result.sort(key=lambda row: (row["benchmark_repo"] or "", row["software_name"] or ""))
        _cache = (time.monotonic(), result)
        return result
