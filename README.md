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
```

Install the UI dependencies, then start both the service and UI with one
command from the repository root:

```bash
npm --prefix ui install
make dev
```

Open <http://localhost:4200>. Angular proxies `/api` calls to FastAPI on port
8000. API documentation is at <http://localhost:8000/docs>.

Results are cached for five minutes, while the page's Refresh button requests
fresh upstream data.

Copy `.env.example` to `.env`, then fill in your RoHub credentials:

```dotenv
ROHUB_USERNAME=your-rohub-username
ROHUB_PASSWORD=your-rohub-password
```

The `.env` configuration file is read directly and excluded from Git. These
credentials are used to download each benchmark's JSON-LD Annotation Collection;
the catalog loads its benchmark name, parameters, metrics, and units with
`semantic_benchmark.BenchmarkLoader`, following `joint-kg.ipynb`.

## Container images

The backend and UI are separate images. Build them from the repository root:

```bash
podman build -f Containerfile.service -t semantic-benchmark-service .
podman build -f Containerfile.ui -t semantic-benchmark-ui .
```

The UI's Nginx server proxies `/api` to `service:8000` by default. Override
`SERVICE_HOST` and `SERVICE_PORT` when the backend uses a different DNS name or
port. For example, run both images in one Podman network:

```bash
podman network create semantic-benchmark
podman run -d --name service --network semantic-benchmark --env-file .env \
  -p 8000:8000 semantic-benchmark-service
podman run -d --name ui --network semantic-benchmark \
  -p 8080:80 semantic-benchmark-ui
```

Open <http://localhost:8080>. The service needs outbound HTTPS access to the
RoHub SPARQL endpoint and `api.zbmath.org`, plus the RoHub credentials described
above.

## Test

```bash
python -m unittest discover -s tests -v
cd ui && npm run build
```

Before making the notebook or repository public, rotate the RoHub password that
is currently stored in a notebook cell and remove it from Git history.
