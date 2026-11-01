# Submission draft — review before sending

**Project:** ArborPulse  
**Tagline:** Read the rhythm of a tree.  
**Track:** Indie developer  
**Theme:** Push the Frontier

## Short description

ArborPulse turns a short tree video into inspectable motion evidence and an arborist-oriented field brief. A local PhysicsLens engine tracks tree features against a stationary background, measures projected displacement and observed response frequency, and exposes the raw signal. Muse Spark combines selected frames, measurements, and field context into grounded observations and on-site questions.

## Problem

A phone video can record how a tree moves, but reviewing many clips without consistent evidence is cumbersome. Arborists need context, a transparent record, and clear limitations—not an unsupported tree-failure prediction.

## What we built

A responsive recording workspace with browser-local video analysis, manually selected regions, stationary-reference correction, time and frequency views, quality gates, field notes, a context-based review queue, text/PDF/CSV/JSON exports, and optional Muse Spark-assisted notes. An independent FastAPI/OpenCV engine supports reproducible backend experiments. Three explicitly synthetic recordings have known input motions for verification.

## Meta integration

Muse Spark 1.3 through Meta Model API, using multimodal chat completions and strict JSON-schema output. The model receives three frames plus compact measured evidence and recorder notes after consent. It drafts observations, questions, and capture advice; it does not manufacture motion measurements or change the deterministic queue priority.

**Activation status:** implementation complete; a real API key and successful live model run are still required. Replace this note with verified results before submitting. Do not describe mocked tests as a live integration.

## Novelty / technical ambition

A transparent combination of image-space physical measurement and model-assisted interpretation. All reported motion has an inspectable time series and capture provenance. Poor measurements produce a recapture request. No claim of competitor-free novelty is made.

## Current limits

The fixtures are synthetic. The prototype has no calibrated tree-failure model, natural-frequency identification, hidden-decay detection, SAM segmentation, or field validation. Rotation, parallax, moving reference foliage, and difficult codecs can impair analysis. Professional on-site assessment remains essential.

## Submission checklist

- [ ] Confirm participant acceptance and read the current official rules in the participant portal.
- [ ] Configure a server-side Meta key; run the genuine three-frame AI flow successfully.
- [ ] Capture at least one suitable real-tree recording and check it with an arborist if feasible.
- [ ] Create and push the GitHub repository to the intended account; verify visibility required by the portal.
- [ ] Confirm that the judging URL is accessible to judges; the default hosted preview is owner-private.
- [ ] Record and upload the actual demo; `demo-script.md` is a script, not a finished video.
- [ ] Add the exact repository, judging, and demo URLs to the portal.
- [ ] Submit personally before the current deadline.

The official event page checked October 31, 2026 lists **November 4, 2026, 9:00 PM Eastern** for submissions. Check the participant portal for any update and exact deliverable requirements. This project has not been submitted automatically.

Official event: https://dev.meta.ai/events/global-hackathon
