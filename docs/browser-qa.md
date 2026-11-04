# Browser QA — 2026-11-02

The current build was exercised in the managed Chrome preview. Evidence exports
are the browser's real output, not a hand-authored sample or a Meta response.

- Five recordings render: two licensed real videos and three labelled fixtures.
- Urban real clip: 171 samples, six timestamped JPEG frames; 12% mean retention;
  frequency suppressed, recapture requested. Raw JSON is retained in
  `examples/urban-browser-evidence.json`. Its version label still reads 0.1.0
  because the export-label correction occurred afterward; its engine is v2.
- Synthetic pine: 216 samples at 640 × 400; observed response 0.7778 Hz versus
  imposed 0.75 Hz, within the 0.0558 Hz bin; 100% retention. The v0.2 browser export
  is in `examples/pine-browser-v2-evidence.json`.
- JSON downloads completed and were parsed to verify frame counts and results.
- Source frame controls, field brief, model-unconfigured state, validation table,
  attribution, and local-setup navigation were inspected through the UI.
- Illustrated report generation, escaping, license retention, CSP and allowed
  image embedding pass unit checks. An HTML download event was not observed in
  this cloud HTTP preview; downloading the HTML artifact through this browser
  remains unverified. No browser security protection was disabled to force it.
- Live Meta remains unverified without a real user key. Model contract fixtures
  do not appear as completed model runs in the product.

The screenshot `screenshots/workspace-v2.jpg` shows the actual new workflow and
labelled fixture. This is desktop browser QA, not a claim of device-lab coverage
or real-world tree-assessment accuracy.

## Follow-up — 2026-11-04

A user-run Windows session produced real Muse Spark scene-planning and grounded
brief receipts. Its exported measurements were independently recomputed and
matched the JSON; low retention and a long tracking dropout correctly required
recapture. This verifies that earlier keyed build, not a new paid call by CI.

The follow-up fixes two evidence mismatches observed in that session:

- The grounded-brief request includes the confirmed tree and reference
  regions as `selectedRegions` metadata, on the same normalized
  0–1000 grid used for scene planning. Instructions identify the confirmed tree
  as the target rather than substituting another tree in the scene.
- A capture plan, its receipt, and its exact input frames are retained together.
  Scanning no longer replaces planning images. The workflow displays a separate
  Scene planning frames collection. Full JSON adds `capturePlanFrames`; HTML
  exports retain both collections and both API receipts. Dismissing or changing
  regions clears the associated plan evidence.

Regression checks exercise the report API after changing the original central
tree to a left-hand target, and HTML export with different images sharing the
same F00 ID in planning and measurement. Both API reference types and distinct
HTML frame identifiers are checked. All 33 JavaScript tests and TypeScript
checks pass. These use labelled fixtures, not live provider responses.

The updated managed-browser build renders successfully; the synthetic pine
again gives 0.78 Hz and 100% retention. HTML generation passes automated checks,
but a download event is still not observed in this cloud HTTP preview. Actual
HTML downloading and the revised Meta prompt require a local keyed rerun.

## Response and decoder repair — prompt v4

The next user export had a successful capture receipt but no brief receipt;
the user reported two report requests returning 502. It does not retain the
rejected provider body, so the exact reason for those failures is unknown.
Its planning F00 JPEG is entirely black, while measurement F00 is normal.

- Both samplers now seek away and back to zero before reading the first image.
  Managed Chrome exercised the actual `sampleClip` on the urban video: all six
  images decoded; F00 at 0 seconds has mean RGB 90 and 39,115 data-URL characters.
- Planning receives the operator's selected tree and cannot accept a proposal
  outside it. A central-target fixture rejects the left-tree proposal.
- The brief request uses the original six measurement IDs. Selection geometry
  is separate metadata. JSON Schema bounds match the runtime validator;
  instructions keep each finding's references in one source category. Concise
  output uses minimal reasoning with a 4,096-token completion allowance.
- Provider truncation, JSON, shape and citation failures return specific codes
  and safe token/finish diagnostics. Raw model text and credentials are omitted;
  invalid results are not cached and no automatic paid retry is made.

Regression tests cover these changes with mocked provider responses. A live
v4 brief still requires the user's local key; this is not claimed as verified.
