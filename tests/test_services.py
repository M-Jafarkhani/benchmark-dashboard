import unittest
from unittest.mock import patch

from app import services


class RunsServiceTests(unittest.TestCase):
    def setUp(self):
        services._cache = None

    @patch("app.services._software_name", return_value="DuMuX")
    @patch("app.services._sparql")
    def test_load_runs_matches_notebook_shape(self, sparql, _name):
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
        }])

    def test_invalid_software_url_has_readable_fallback(self):
        self.assertEqual(services._software_name("https://example.test/tool/Foo"), "Foo")


if __name__ == "__main__":
    unittest.main()
