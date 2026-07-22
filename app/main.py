from pathlib import Path

from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from .services import UpstreamError, load_runs

FRONTEND = Path(__file__).resolve().parent.parent / "frontend"
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


@app.get("/", include_in_schema=False)
def index() -> FileResponse:
    return FileResponse(FRONTEND / "index.html")


app.mount("/assets", StaticFiles(directory=FRONTEND), name="assets")
