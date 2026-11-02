# Local first, judging URL second

The recommended development setup is your computer running the app's server.
The browser calls `localhost:5173`; that server sends selected frames and compact
measurements to Meta using a key read from ignored `.dev.vars`. Hosting is optional.

## Local installation

Node.js 22.13+, Git, pnpm 11.25.0:

```bash
git clone https://github.com/Finraell/ArborPulse.git
cd ArborPulse
corepack enable
corepack prepare pnpm@11.25.0 --activate
pnpm install --frozen-lockfile
pnpm setup:local
```

Edit `.dev.vars` locally:

```dotenv
MODEL_API_KEY="your-own-key"
META_MODEL="muse-spark-1.3"
META_MAX_REQUESTS_PER_HOUR="20"
```

```bash
pnpm local:doctor
pnpm meta:check
pnpm local
```

`setup:local` creates a blank file without replacing an existing one. The doctor
prints key presence, never its value. The access check performs one small paid
request; it prints model, response ID, and usage only. The local server binds to
127.0.0.1. `Start-ArborPulse.ps1` is a Windows launch shortcut after installation.

`pnpm security:check` rejects tracked credential files and recognizable key
material. Git ignores local credentials; this check is an additional guard, not
a guarantee that every possible secret format is detectable. Never upload the
configuration file or copy a key into the browser, a demo, a source archive, or Git.

## Credits and cost

Use the key belonging to the account/team where the $150 credits are available.
Confirm provider, eligible models, expiry, and remaining balance in that provider's
dashboard. The current adapter targets Meta Model API; credits from a different
inference provider are not automatically transferable.

Muse Spark standard-mode estimates currently use $1.25/M input, $4.25/M output,
and $0.15/M cached input tokens (official pricing checked 2026-11-02). For example,
10,000 input + 1,000 output tokens are approximately $0.01675, excluding any
account-specific adjustments. Image/reasoning token use varies; this is not a
promise about the number of inspections $150 will buy. The account invoice and
provider budget controls are authoritative. No Contributor-data mode is enabled.

Receipts preserve returned usage and estimated cost. In-flight deduplication and
30-minute validated-result caching reduce accidental repeats. No auto-retries.
The request cap is per running process and resets after restart; use provider-side
budgets as well. Session totals include this tab's successful new responses only;
rejected requests may still consume provider tokens and are not included.

## Hosted deployment

The existing owner-private Site is
https://arborpulse-dima.finraell.chatgpt.site . The source project identity in
`.openai/hosting.json` is retained for updates. Do not reuse it for another user's
project. `pnpm build` emits Worker code and static assets in `dist/`.

A judging deployment needs `MODEL_API_KEY` set as a **server-side hosting secret**;
`META_MODEL` and `META_MAX_REQUESTS_PER_HOUR` may also be configured. Never use a
`VITE_` or `NEXT_PUBLIC_` credential. Apply the hosting environment revision and
redeploy. No GitHub secret is required to run the app locally or through Sites.

The site remains owner-private and unkeyed until deliberately configured. Site
access and repository visibility are separate. Before public paid-model access,
add authenticated users, durable per-user quotas, budget enforcement and abuse
controls. A process-local cap is insufficient for multiple Worker instances.

## Request and data boundaries

Both AI routes require explicit consent, same-origin browser requests, bounded
JSON bodies (1 MB including streaming), bounded notes, and validated frame IDs.
Reports recompute measurements from consistent regular samples. The model has a
60-second deadline. Invalid JSON, regions, evidence references, or truncated
responses cannot become cached successful results. Errors omit upstream bodies
and credentials. A configured key is not displayed as a verified model response.

- Full videos: browser memory; no upload in the normal frontend.
- AI action: six timestamped JPEG frames, notes, and compact measurements are
  sent through the server to Meta. Consult the provider's account terms.
- Saved briefs: text/name/date in browser localStorage, maximum 30 records.
- Exports: downloaded locally. Full JSON and HTML contain source-frame evidence;
  retain media attribution and share with the intended reviewer.
- Optional Python API: explicitly uploaded video exists temporarily and is removed
  on completion/error. Its frontend integration is not enabled.

The OpenCV API requires separate auth and reverse-proxy/body limits in production.
Local Docker binds to loopback. Browser localStorage is not encrypted or synced.
