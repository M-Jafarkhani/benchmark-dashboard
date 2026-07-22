# Semantic Benchmark Dashboard

A small FastAPI backend and dependency-free frontend that reproduce the `df`
shown after `df.drop(columns=["software_url"])` in `joint-kg.ipynb`. The API
also retains `software_url` so each displayed software name links to its zbMATH
Open record. A benchmark catalog collects the GitHub and RoHub links above the
runs table; the Open RO link points to the individual run resource.
RoHub queries use the same `configure_rohub` and `query_sparql` functions from
the `semantic-benchmark` package as the notebook.

## Run locally

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Open <http://localhost:8000>. API documentation is at `/docs`; the runs API is
at `/api/runs`. Results are cached for five minutes, while the page's Refresh
button requests fresh upstream data.

Copy `.env.example` to `.env`, then fill in your RoHub credentials:

```dotenv
ROHUB_USERNAME=your-rohub-username
ROHUB_PASSWORD=your-rohub-password
```

The `.env` configuration file is read directly and excluded from Git. These
credentials are used to download each benchmark's JSON-LD Annotation Collection;
the catalog reads its benchmark name, parameters, and metrics with RDFLib,
following `joint-kg.ipynb`.

## Publish

Build and deploy the included Dockerfile on a platform such as Render, Railway,
Fly.io, or any container host. A Render Blueprint (`render.yaml`) is included,
so that repository can be deployed there directly. The service needs outbound HTTPS access
to the RoHub SPARQL endpoint and `api.zbmath.org`. No credentials are needed for
this first dashboard step.

```bash
docker build -t benchmark-dashboard .
docker run --rm -p 8000:8000 benchmark-dashboard
```

## Test

```bash
python -m unittest discover -s tests -v
```

Before making the notebook or repository public, rotate the RoHub password that
is currently stored in a notebook cell and remove it from Git history.
