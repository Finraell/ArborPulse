# Deployment and operations

## Hosted app

This repository includes the supplied Sites/Vinext Vite integration. `pnpm build` emits a Worker deployment and static assets in `dist/`. Keep the tracked `.openai/hosting.json` project identity when updating this deployment. Do not copy that identity to a different user's deployment.

The current deployment defaults to owner-private. Source visibility on GitHub and website audience are separate. Granting judges access requires an intentional sharing decision; a private URL alone is not a publicly accessible demo.

Set `MODEL_API_KEY` as a server-side hosting secret and optionally `META_MODEL=muse-spark-1.3`. Never use a `VITE_` or `NEXT_PUBLIC_` prefix for a model credential. Deploy after changing the environment revision. `/api/health` reports whether a key is configured but never returns its value.

`POST /api/report` checks request origin, explicit consent, payload size (including streamed bodies), bounded field lengths, box bounds, regular sample times, and consistency of corrected displacements. It recalculates summary measurements rather than trusting client-provided metric values. It sets a 45-second model deadline and validates the returned JSON. Browser-supplied measurements are still untrusted evidence; recalculation does not certify that the underlying capture was genuine.

The owner-private hosting boundary protects the model endpoint. Before public multi-user deployment, add authentication, per-user rate limits, usage quotas, abuse controls, and cost monitoring appropriate to your host. Do not expose an unrestricted paid-model endpoint.

## Local configuration

Create `.dev.vars` from `.env.example` for the Cloudflare development runtime. Real values are ignored by Git. Never paste credentials into source, screenshots, demos, issues, or commits.

## OpenCV service

The optional API is independent of the browser engine. It accepts video uploads when called explicitly and deletes its temporary files after each analysis. The current frontend does not call it. Run it behind a reverse proxy with request body and timeout limits; set a strong `ARBORPULSE_API_TOKEN` and explicit `CORS_ORIGINS`. Local Docker Compose binds only to 127.0.0.1 and caps temporary storage and memory.

## Data lifecycle

- Browser analysis: no network upload; decoded frames and series exist in memory.
- Explicit AI generation: at most three JPEG frames, field context, and compact metrics go through the server to Meta. Consult Meta account terms for provider-side handling.
- Local saved briefs: text and name/date in browser localStorage, up to 30 records.
- Exports: downloaded by the user; no hosted database or cloud video archive.
- Python API: explicitly uploaded clip stored temporarily and removed on completion/error.

No claim is made that browser localStorage is encrypted or synchronized across devices.
