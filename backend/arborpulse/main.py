"""Optional upload API. The hosted web app uses local browser analysis by default."""
import asyncio
import hmac
import json
import os
from pathlib import Path
import tempfile
from fastapi import Depends, FastAPI, File, Form, Header, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from starlette.concurrency import run_in_threadpool
from .motion import analyze_video

app = FastAPI(title="ArborPulse PhysicsLens", version="0.1.0")
app.add_middleware(CORSMiddleware, allow_origins=os.getenv("CORS_ORIGINS", "http://localhost:5173,http://localhost:8787").split(","), allow_methods=["GET", "POST"], allow_headers=["Content-Type", "Authorization"])
analysis_slot = asyncio.Semaphore(1)
MAX_UPLOAD = 100*1024*1024


async def authorize(authorization: str | None = Header(default=None)):
    token = os.getenv("ARBORPULSE_API_TOKEN", "")
    if os.getenv("ENVIRONMENT") == "production" and not token:
        raise HTTPException(503, "Configure ARBORPULSE_API_TOKEN for production access")
    if token and not hmac.compare_digest(authorization or "", f"Bearer {token}"):
        raise HTTPException(401, "Invalid or missing analysis API token")


@app.get("/health")
def health():
    return {"status": "ok", "engine": "OpenCV Lucas-Kanade", "version": "0.1.0"}


@app.post("/v1/analyze", dependencies=[Depends(authorize)])
async def analyze(file: UploadFile = File(...), tree_box: str = Form(...), reference_box: str = Form(...)):
    try:
        tree, background = json.loads(tree_box), json.loads(reference_box)
        if not isinstance(tree, list) or not isinstance(background, list):
            raise ValueError("Regions must be normalized [x, y, width, height] arrays")
    except (ValueError, TypeError) as error:
        raise HTTPException(400, "Invalid region JSON") from error
    if Path(file.filename or "").suffix.lower() not in {".mp4", ".mov", ".m4v", ".webm"}:
        raise HTTPException(400, "Use MP4, MOV, or WebM")
    try:
        # A bounded worker and a private temporary directory; uploads are deleted on exit.
        async with analysis_slot:
            with tempfile.TemporaryDirectory(prefix="arborpulse-") as directory:
                path = Path(directory) / ("capture" + Path(file.filename or "").suffix.lower())
                size = 0
                with path.open("wb") as output:
                    while chunk := await file.read(1024*1024):
                        size += len(chunk)
                        if size > MAX_UPLOAD:
                            raise HTTPException(413, "Maximum upload size is 100 MB")
                        output.write(chunk)
                result = await run_in_threadpool(analyze_video, path, tree, background)
                return {"analysis": result, "retained": False}
    except ValueError as error:
        raise HTTPException(400, str(error)) from error
    finally:
        await file.close()
