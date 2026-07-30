# Semantic Benchmark Dashboard

A FastAPI backend and Angular/PrimeNG frontend that reproduce and extend the
data flow in `joint-kg.ipynb`. The API
also retains `software_url` so each displayed software name links to its zbMATH
Open record. A benchmark catalog collects the GitHub and RoHub links above the
runs table; the Open RO link points to the individual run resource.
RoHub queries use the same `configure_rohub`, `query_sparql`, and
`build_dynamic_query` functions from the `semantic-benchmark` package as the
notebook. AG Grid provides filtering and multi-run selection, while Plotly
provides interactive comparison plots.

## Run locally

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

In a second terminal, start Angular's development server:

```bash
cd ui
npm install
npm start
```

Open <http://localhost:4200>. Angular proxies `/api` calls to FastAPI on port
8000. API documentation is at <http://localhost:8000/docs>.

For a production-style local run, build Angular before starting FastAPI:

```bash
cd ui && npm ci && npm run build
cd .. && uvicorn app.main:app
```

Then open <http://localhost:8000>. Results are cached for five minutes, while
the page's Refresh button requests fresh upstream data.

Copy `.env.example` to `.env`, then fill in your RoHub credentials:

```dotenv
ROHUB_USERNAME=your-rohub-username
ROHUB_PASSWORD=your-rohub-password
```

The `.env` configuration file is read directly and excluded from Git. These
credentials are used to download each benchmark's JSON-LD Annotation Collection;
the catalog loads its benchmark name, parameters, metrics, and units with
`semantic_benchmark.BenchmarkLoader`, following `joint-kg.ipynb`.

## Publish

Build and deploy the included Dockerfile on a platform such as Render, Railway,
Fly.io, or any container host. A Render Blueprint (`render.yaml`) is included,
so that repository can be deployed there directly. The service needs outbound
HTTPS access to the RoHub SPARQL endpoint and `api.zbmath.org`, plus a populated
`.env` configuration file containing the RoHub credentials.

```bash
docker build -t benchmark-dashboard .
docker run --rm -p 8000:8000 benchmark-dashboard
```

## Test

```bash
python -m unittest discover -s tests -v
cd ui && npm run build
```

Before making the notebook or repository public, rotate the RoHub password that
is currently stored in a notebook cell and remove it from Git history.
