# ArborPulse

**Every tree has a rhythm. Turn a short video into measurable motion and an inspection evidence brief.**

Built during the **Meta Global AI Developer Hackathon 2026**, indie developer track, **Push the Frontier** theme.

ArborPulse tracks a selected tree region against a stationary reference, measures projected sway, and produces a reviewable field brief. **Muse Spark 1.3** can combine sampled frames, measurements, and recorder notes into grounded observations and questions for a qualified arborist.

> Experimental inspection support. This project does not detect hidden decay, predict tree failure, certify safety, or replace an on-site arborist assessment. Included videos are explicitly synthetic fixtures, not a field-validation dataset.

## Run the app

Requires Node.js **22.13+** and pnpm **11.25.0**.

```bash
corepack enable
corepack prepare pnpm@11.25.0 --activate
pnpm install --frozen-lockfile
pnpm dev
```

Open **http://localhost:5173**. No API key is needed for local video analysis, the synthetic demos, charts, deterministic reports, or exports.

### Enable the Meta integration

Copy `.env.example` to `.dev.vars` and set `MODEL_API_KEY` to your own Meta Model API key. Restart the development server. Keep the file untracked. For a hosted Site, set the same variable as a **server-side secret** in the hosting environment and deploy the updated environment revision.

In **Field brief**, explicitly consent to sending three JPEG frames, measured values, and the entered field notes, then select **Generate AI notes**. The full video stays in the browser. A missing key or failed model request never produces a fabricated AI response: the local evidence brief remains available and the UI displays connection status.

The adapter uses the documented endpoint `https://api.meta.ai/v1/chat/completions`, model `muse-spark-1.3`, multimodal `image_url` input, and strict JSON-schema output. The response is validated again server-side. No live Meta request has been verified in this environment because no Meta API key was provided; provider behavior is covered by mocked contract tests.

## Use it

1. Select **Riverside oak**, **Meadow pine**, or **Windy capture**, or upload an MP4/MOV/WebM clip (maximum 250 MB in the browser).
2. Select **Tree region** and drag over a textured branch junction or crown. Select **Fixed reference** and drag over a separate stationary textured wall, post, or ground patch. Demo regions are preselected.
3. Select **Run motion scan**. The browser samples the first 30 seconds at 12 fps and at most 512 px width. Videos need at least 6 seconds; 20–30 seconds is preferable.
4. Inspect the displacement trace, spectrum, tracking retention, and capture notes. Poor captures request a recapture rather than reporting a convincing-looking frequency.
5. Enter visible concerns, target occupancy, and notes. Open **Field brief**. Queue priority depends on capture quality and reported field context, not sway amplitude.
6. Download the text brief, print to PDF, export raw samples to CSV or the full evidence record to JSON, or save a brief in the current browser.

MOV/HEVC decoding depends on the browser. If decoding fails, use an H.264 MP4. Uploads are session-local; a browser refresh discards the selected video. Only explicitly saved text briefs persist in local storage. The install manifest supports adding the app to a home screen; offline analysis after closing/reloading the app is not guaranteed.

## What is implemented

| Capability | Implementation |
| --- | --- |
| Video input | Browser-local files and three reproducible synthetic MP4s |
| Region selection | Manual normalized boxes for tree and stationary reference |
| Browser tracking | Textured-corner selection, normalized patch correlation, forward/backward rejection |
| Camera correction | Median translation of the reference subtracted from tree translation |
| Signal analysis | Linear detrending, Hann-windowed DFT, gated dominant observed response |
| Inspectable evidence | Time series, spectrum, retention, capture warnings, CSV/JSON |
| Field brief | Deterministic evidence + context, text export, print/PDF, local saves |
| Meta integration | Muse Spark 1.3 reads three frames + measured evidence, returns validated notes |
| Optional backend | FastAPI + OpenCV Lucas–Kanade upload analysis service |
| SAM 3.1 / voice | Not implemented; no segmentation or transcription claims |

## Validate

```bash
pnpm typecheck
pnpm test
pnpm build
```

The TypeScript suite verifies frequency recovery, drift removal, noise/quality gates, context-based queueing, report provenance, Meta request/response contracts, input consistency, consent, origin checks, and payload limits.

Optional OpenCV service tests:

```bash
python -m venv .venv
# macOS/Linux; Windows: .venv\Scripts\activate
source .venv/bin/activate
pip install -r backend/requirements-dev.txt
PYTHONPATH=backend pytest backend/tests -q
```

The Python suite decodes the actual MP4 fixtures, tracks the two regions, verifies known imposed frequencies, rejects the shaking-camera fixture, and tests the upload API. Recreate fixtures with `python scripts/generate_demo.py` (Pillow and system ffmpeg required).

## Optional OpenCV API

The web app uses its **browser engine by default**; this separate API is for reproducible server-side analysis and integration work. No uploaded video is sent to this service by the current UI.

```bash
pip install -r backend/requirements.txt
PYTHONPATH=backend uvicorn arborpulse.main:app --reload --port 8000
```

Then use **http://localhost:8000/docs**, or:

```bash
curl http://localhost:8000/v1/analyze \
  -F 'file=@public/demo/oak.mp4' \
  -F 'tree_box=[0.33,0.23,0.32,0.32]' \
  -F 'reference_box=[0.78,0.46,0.16,0.28]'
```

The API accepts at most 100 MB per upload, samples at approximately 12 fps for up to 30 seconds, serializes CPU-heavy work, and deletes temporary uploads. For deployment set `ENVIRONMENT=production` and `ARBORPULSE_API_TOKEN`; pass it as `Authorization: Bearer …`. `docker compose up --build` runs the service on loopback port 8000 and requires that token. Do not expose the development service directly to the public internet.

## Project structure

- `components/Workspace.tsx` — recording workflow and evidence UI.
- `lib/arbor/video.ts` — local video sampler and patch tracker.
- `lib/arbor/signal.ts` — deterministic signal processing.
- `lib/arbor/brief.ts` — context-based queue and exportable brief.
- `lib/arbor/meta.ts`, `app/api/report/route.ts` — bounded, server-side Meta adapter.
- `backend/arborpulse/` — optional FastAPI/OpenCV engine.
- `public/demo/` — generated fixtures, posters, and known input parameters.
- `docs/` — methodology, deployment, submission draft, demo script, and measured validation.

The frontend is React/TypeScript on **Vite + Vinext**, using the Next App Router API shape. The supplied Sites integration packages a Cloudflare Worker; no database, external map, or paid asset service is required. Hosting is owner-private unless you explicitly change its audience. A public judging URL requires a separate sharing/deployment decision.

## Scientific limits

Observed response depends on wind forcing, viewpoint, scale, foliage, and tree geometry. It is **not automatically a natural frequency**. Detrended displacement is measured in pixels at the analysis resolution, with no meter or angle conversion. Translation correction does not remove camera rotation, rolling shutter, parallax, or independently moving reference objects. A single tracked region is not a structural model. Synthetic verification demonstrates software behavior; field validity requires real recordings and arborist review.

See [Methodology](docs/methodology.md), [Demo script](docs/demo-script.md), [Submission draft](docs/submission.md), and [Deployment](docs/deployment.md).

## Primary references

- [Meta Global AI Developer Hackathon](https://dev.meta.ai/events/global-hackathon)
- [Meta chat completions quickstart](https://dev.meta.ai/docs/cookbook/quickstart-chat-completions)
- [Meta image understanding](https://dev.meta.ai/docs/image-understanding)
- [Meta structured output](https://dev.meta.ai/docs/structured-output)
- [OpenCV optical flow](https://docs.opencv.org/4.x/d4/dee/tutorial_optical_flow.html)

MIT licensed. Created by Dmitriy Sushkov.
