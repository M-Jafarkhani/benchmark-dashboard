from pathlib import Path

from fastapi import FastAPI, HTTPException, Query
from fastapi.staticfiles import StaticFiles

from .services import (
    RunNotFoundError,
    UpstreamError,
    clear_sparql_log,
    load_runs,
    query_run_values,
    sparql_log,
)

ANGULAR_UI = Path(__file__).resolve().parent.parent / "ui" / "dist" / "ui" / "browser"
app = FastAPI(title="Semantic Benchmark Dashboard", version="0.1.0")


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/runs")
def runs(refresh: bool = Query(False, description="Bypass the five-minute cache")):
    try:
        items = load_runs(force=refresh)
    except UpstreamError as error:
        raise HTTPException(status_code=502, detail=str(error)) from error
    return {"items": items, "count": len(items)}


@app.get("/api/run-values")
def run_values(run_id: str = Query(..., description="Published run IRI")):
    try:
        return query_run_values(run_id)
    except RunNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except UpstreamError as error:
        raise HTTPException(status_code=502, detail=str(error)) from error


@app.get("/api/sparql-log")
def recent_sparql_log():
    items = sparql_log()
    return {"items": items, "count": len(items)}


@app.delete("/api/sparql-log", status_code=204)
def delete_sparql_log():
    clear_sparql_log()


app.mount("/", StaticFiles(directory=ANGULAR_UI, html=True, check_dir=False), name="ui")
