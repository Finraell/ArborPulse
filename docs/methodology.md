# PhysicsLens methodology

## Measured quantity

A projected image-space motion time series relative to a selected stationary reference. Values refer to the resized analysis image, not original pixels or physical distance.

## Browser pipeline

1. Decode a local or same-origin video. Sample at 12 Hz, cap processing at 30 seconds, and resize to at most 512 pixels wide while preserving aspect ratio.
2. Within the selected regions, compute a small-window image-gradient covariance score. Keep spatially separated textured corners (up to 18 tree features and 12 reference features).
3. Match each 7 × 7 patch in a ±6 pixel search neighborhood using normalized cross-correlation. Require score ≥0.8 and a forward/backward positional error ≤1.5 pixels. Rejected points remain rejected; the tracker does not invent or silently refresh evidence.
4. At each sample, calculate the median accumulated displacement of surviving features in each region. Subtract reference translation from tree translation. Record quality as the minimum of the two retained feature fractions; fewer than three features in either region gives zero quality. When a group is lost, its last translation is held and quality is zero, which must be considered when interpreting the trace.
5. Fit and remove a straight-line trend from x and y displacement. Select the higher-variance axis for the summary spectrum, RMS, and peak-to-peak displacement. The time chart displays the un-detrended, camera-corrected horizontal x series; the spectrum may use y when its variance is higher.
6. Apply a Hann window and calculate DFT bins. Search for an observed response peak between 0.1 and 2 Hz. Frequency resolution is approximately 1 / observed duration.
7. A capture is usable when duration ≥6 seconds, mean track retention ≥65%, and reference-motion RMS ≤5 analysis pixels. A frequency is shown only with RMS ≥0.35 pixels, peak-neighborhood concentration ≥0.30, and at least three observed cycles.

Thresholds are prototype engineering choices, not clinically or scientifically calibrated tree-risk thresholds. A capture can be usable while no stable response frequency is resolved.

## Optional OpenCV pipeline

The FastAPI service uses Shi–Tomasi corners and pyramidal Lucas–Kanade optical flow with forward/backward rejection. It follows the same reference-subtraction and summary principles; its numerical results can differ from the browser patch tracker. It is a separate service, not a hidden hosted upload path.

## Inspection queue

- Failed capture-quality gate → **Recapture**.
- Usable capture + recorder-reported visible concern + an occupied target → **Review first**.
- Other usable captures → **Standard review**.

This is a workflow heuristic, not a risk assessment. Movement amplitude and frequency do not raise or lower the structural safety classification. No safe/unsafe classification or failure probability exists.

## Meta model role

Muse Spark receives compact measured evidence, entered field context, and up to three sampled JPEG frames after explicit consent. A structured prompt separates measured evidence from reported concerns and visible observations. Strict JSON output contains summary, observations, on-site questions, and capture advice; Zod validates it. The model cannot change the deterministic queue result. AI output is labelled assisted and requires review; generation errors leave deterministic evidence intact.

A prompt and output schema cannot guarantee factual correctness. The professional reviewer remains responsible for interpretation. Do not treat the model's prose as independent measurement.

## Validation boundary

`public/demo/ground-truth.json` records imposed input motions for generated fixtures. Fixture tests validate decoding, tracking, stabilization, frequency recovery, and capture-quality rejection. They do not validate failure prediction, defects, species generalization, consumer-camera artifacts, field wind conditions, or utility-vegetation decisions. Next validation work requires a diverse, consented real-video dataset and review by qualified arborists.
