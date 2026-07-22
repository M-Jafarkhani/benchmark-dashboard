import unittest
from types import ModuleType
from unittest.mock import MagicMock, patch

from app import services


class SemanticBenchmarkClientTests(unittest.TestCase):
    def setUp(self):
        services._query_sparql.cache_clear()

    def test_sparql_uses_configured_semantic_benchmark_client(self):
        configure = MagicMock()
        query = MagicMock()
        frame = MagicMock()
        frame.to_dict.return_value = [{"run_id": "run:1"}]
        query.return_value = frame

        package = ModuleType("semantic_benchmark")
        rohub = ModuleType("semantic_benchmark.rohub")
        rohub.configure_rohub = configure
        rohub.query_sparql = query

        with patch.dict("sys.modules", {
            "semantic_benchmark": package,
            "semantic_benchmark.rohub": rohub,
        }):
            self.assertEqual(services._sparql("SELECT * WHERE {}"), [{"run_id": "run:1"}])
        configure.assert_called_once_with(use_production_rohub=True)
        query.assert_called_once_with("SELECT * WHERE {}")
        frame.to_dict.assert_called_once_with(orient="records")


if __name__ == "__main__":
    unittest.main()
