# Measurement and model methodology — v0.2

ArborPulse is an experimental inspection-evidence workflow. It measures image
motion and prepares questions for an arborist. It does not infer hidden decay,
anchorage, failure probability, safe wind speed, or certified risk.

## Local video measurement

The browser decodes at 12 samples/second, up to 60 seconds, scaled to at most
640 px width. A user supplies two separate normalized boxes, manually or by
confirming a Muse Spark proposal: a textured rigid tree feature and a stationary
world reference. A wall or fixed post may work; another crown, timestamp, logo,
or watermark does not establish a stationary reference.

Textured corners use a minimum-eigenvalue gradient score and spatial separation.
The browser tracks 7 × 7 patches in a ±6 px search window using normalized
correlation ≥0.8, rejecting forward/backward disagreement >1.5 px. Median tree
translation minus median reference translation gives a projected trajectory.
Tracks are not silently replenished; mean retention and sustained dropout remain
visible. Held trajectories after feature loss must fail the quality gate.

Linear detrending removes drift from the corrected response, a Hann window reduces
spectral leakage, and a DFT finds the strongest response in 0.1–2 Hz on the axis
with greater detrended energy. Reported amplitude is detrended peak-to-peak motion
in analysis pixels. Frequency-bin spacing is approximately 1/duration. No
sub-bin accuracy, natural-frequency identification, or metric displacement is claimed.

A frequency is suppressed unless capture length ≥6 s, mean feature retention
≥65%, no dropout longer than 0.5 s, reference-motion RMS ≤5 px, response RMS
≥0.35 px, spectral concentration ≥0.3, and at least three observed cycles.
Reference RMS is centered, **not linearly detrended**, so a steady camera pan cannot
be hidden. Known source limitations (the Trout Lake moving-camera example)
override numerical retention and force recapture. These conservative heuristics
are not learned or scientifically calibrated structural thresholds.

The optional Python engine uses pyramidal OpenCV Lucas–Kanade with separate
corner selection, subpixel trajectories and forward/backward rejection. It shares
the signal and capture-gate principles, 640 px width and 60 s cap; it is not the
same tracker as the browser. Results are labelled by engine. The frontend does
not send videos to this service.

## Two model stages

Muse Spark 1.3 is called through server-side Meta Model API chat completions.
The local server alone holds `MODEL_API_KEY`.

1. Scene planning receives six JPEG frames labelled F00–F05 with source times,
   plus recorder notes. It proposes two normalized 0–1000 boxes, explains the
   choice, and cites source frames in capture checks. The adapter enforces
   bounds/non-overlap and rejects unknown IDs. The user must confirm boxes.
2. Grounded interpretation receives the same sampled frame IDs, compact
   deterministic measurements M_frequency/M_sway/M_tracking/M_camera/M_capture/
   M_duration and field evidence F_notes/F_target/F_concern. Every finding must
   identify its source type and cite valid IDs of that type. References are
   validated after strict JSON-schema parsing. Raw sample series are not sent.

Notes/images are explicitly treated as untrusted data in the prompt. Reference
validation prevents nonexistent citations; it cannot prove that the model's
interpretation is visually or scientifically correct. Human review remains needed.
Six stills cannot establish everything visible in a complete video.

Only a successful, validated response receives model/request/time/prompt-version/
usage provenance in the UI. A key-presence health check is not a successful model
call. Mocked contracts are labelled tests, not model demonstrations. Cost estimates
use published standard-mode rates and do not replace account billing.

## Queue and reporting

Poor capture quality → Recapture. Otherwise a recorder-reported concern plus an
occupied target → Review first; other records → Standard review. These are workflow
queues. Neither response amplitude nor frequency decides tree risk or alters a
priority through model interpretation.

Reports retain measurements, units, context, warnings, media source/license,
source frames, model findings, references and response provenance when available.
HTML exports are standalone, escaped, script-free and forbid remote assets.
CSV contains raw samples; full JSON also contains source-frame evidence. Saved
browser briefs retain only text. User recordings are not persisted by the app.

## Verification and limits

- Synthetic oak/pine impose 0.35/0.75 Hz and test frequency recovery within one bin.
- Camera-shake, pan and dropout cases test refusal behavior.
- Real urban footage has no motion/tree-health truth; it tests capture limitations.
- Trout Lake footage has a camera mounted on another tree and no established
  world-fixed reference. Published optical estimates 0.23–0.24 Hz differ from
  the matching-window 0.49 Hz accelerometer estimate. A 30-minute 0.24 Hz sensor
  result is a different window. We do not fit a favorable ground-truth label.
- TypeScript provider fixtures test protocol/validation, not real model quality.
- Raw OpenCV evidence and the reproducible manifest are in docs/data and
  public/validation/report.json. Browser outputs are stored separately.

Translation subtraction does not correct camera rotation, rolling shutter,
parallax, zoom or an independently moving reference. Wind forcing, foliage,
viewpoint, calibration and tree geometry affect the response. Diverse field
captures, professional review and independent measurements remain necessary to
assess real-world usefulness. No failure model has been validated here.
