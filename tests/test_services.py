import unittest
import time
from unittest.mock import patch

from rdflib import Graph, Literal, Namespace, URIRef
from rdflib.namespace import RDF, RDFS

from app import services


class RunsServiceTests(unittest.TestCase):
    def setUp(self):
        services._cache = None

    @patch("app.services._software_name", return_value="DuMuX")
    @patch("app.services._benchmark_metadata", return_value={
        "benchmark": "Flow benchmark",
        "parameters": ["grid cells"],
        "metrics": ["L2 error"],
    })
    @patch("app.services._sparql")
    def test_load_runs_matches_notebook_shape(self, sparql, _metadata, _name):
        sparql.side_effect = [
            [{"run_id": "run:1", "benchmark_url": "https://ro/1", "benchmark_repo": "https://repo/1", "software_url": "https://zbmath.org/software/1", "datePublished": "2026-07-22"}],
            [{"run_id": "run:1", "graph": "https://graph/1"}],
        ]
        self.assertEqual(services.load_runs(), [{
            "run_id": "run:1",
            "benchmark_url": "https://ro/1",
            "benchmark_repo": "https://repo/1",
            "graph": "https://graph/1",
            "software_name": "DuMuX",
            "software_url": "https://zbmath.org/software/1",
            "datePublished": "2026-07-22",
            "benchmark": "Flow benchmark",
            "parameters": ["grid cells"],
            "metrics": ["L2 error"],
        }])

    @patch("app.services._download_benchmark_graph")
    def test_benchmark_metadata_is_extracted_from_json_ld_graph(self, download):
        m4i = Namespace("http://w3id.org/nfdi4ing/metadata4ing#")
        benchmark = URIRef("https://example.test/benchmark")
        parameter_set = URIRef("https://example.test/parameter-set")
        parameter = URIRef("https://example.test/parameter")
        metric = URIRef("https://example.test/metric")
        graph = Graph()
        graph.add((benchmark, RDF.type, m4i.Benchmark))
        graph.add((benchmark, RDFS.label, Literal("Flow benchmark")))
        graph.add((benchmark, m4i.hasParameterSet, parameter_set))
        graph.add((parameter_set, services.BFO_HAS_PART, parameter))
        graph.add((parameter, RDFS.label, Literal("grid cells")))
        graph.add((benchmark, m4i.evaluates, metric))
        graph.add((metric, RDFS.label, Literal("L2 error")))
        download.return_value = graph

        self.assertEqual(services._benchmark_metadata("https://ro/uuid"), {
            "benchmark": "Flow benchmark",
            "parameters": ["grid cells"],
            "metrics": ["L2 error"],
        })

    def test_invalid_software_url_has_readable_fallback(self):
        self.assertEqual(services._software_name("https://example.test/tool/Foo"), "Foo")

    @patch("app.services._safe_variable_name", side_effect=lambda value: value.replace(" ", "_"))
    @patch("app.services._dynamic_query", return_value="DYNAMIC QUERY")
    @patch("app.services._sparql", return_value=[{
        "grid_cells": "64",
        "L2_error": "0.001",
        "tool_name": "DuMuX",
    }])
    def test_query_run_values_uses_run_graph_and_returns_labeled_columns(
        self, sparql, dynamic_query, _safe_name
    ):
        services._cache = (time.monotonic(), [{
            "run_id": "run:1",
            "graph": "graph:1",
            "software_name": "DuMuX",
            "benchmark": "Flow benchmark",
            "parameters": ["grid cells"],
            "metrics": ["L2 error"],
        }])

        result = services.query_run_values("run:1")

        dynamic_query.assert_called_once_with(["grid cells"], ["L2 error"], "graph:1")
        sparql.assert_called_once_with("DYNAMIC QUERY")
        self.assertEqual(result["columns"], [
            {"key": "grid_cells", "label": "grid cells", "kind": "parameter"},
            {"key": "L2_error", "label": "L2 error", "kind": "metric"},
        ])
        self.assertEqual(result["rows"], [{
            "grid_cells": "64",
            "L2_error": "0.001",
        }])


if __name__ == "__main__":
    unittest.main()
