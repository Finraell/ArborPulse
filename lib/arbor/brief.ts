import type { Analysis, Brief, FieldContext } from "./types";

export function createBrief(analysis: Analysis, context: FieldContext): Brief {
  const priority = !analysis.usable ? "Recapture" : context.concern && context.target !== "none" ? "Review first" : "Standard review";
  return {
    priority,
    summary: !analysis.usable
      ? "This recording does not support a reliable motion comparison. Improve the capture before using it in the inspection queue."
      : priority === "Review first"
        ? "A reported visible concern and a nearby occupied target make this a useful candidate for an arborist’s earlier review. Motion measurements document the recording; they do not establish structural risk."
        : "The recording supports a motion evidence brief. Add it to routine arborist review with the field context below.",
    evidence: [
      `${analysis.samples.length} frames sampled over ${analysis.duration.toFixed(1)} seconds; ${(analysis.coverage * 100).toFixed(0)}% mean tracking retention.`,
      `Camera-corrected projected displacement: ${analysis.amplitude.toFixed(1)} px peak to peak at ${analysis.width} × ${analysis.height} analysis resolution.`,
      analysis.frequency ? `Dominant observed response: ${analysis.frequency.toFixed(2)} Hz (frequency resolution ≈ ${(1 / analysis.duration).toFixed(2)} Hz). This is not necessarily the tree’s natural frequency.` : "A repeatable oscillation frequency was not resolved.",
      `Stationary-reference motion: ${analysis.cameraRms.toFixed(2)} px RMS before correction.`,
      `Field context: ${context.target === "none" ? "no target reported" : context.target + " target occupancy"}; visible concern ${context.concern ? "reported by recorder" : "not reported"}.`,
    ],
    nextSteps: priority === "Recapture"
      ? ["Use a tripod or brace the phone; include a stationary building or post.", "Record 20–30 seconds in daylight without zooming or panning.", "Select a rigid branch junction and a separate textured reference, then scan again."]
      : ["Have a qualified arborist review the recording, field notes, target occupancy, and visible defects.", "Inspect the root collar, trunk, and branch attachments on site; record observations separately.", "Repeat from the same view under comparable wind conditions to build a useful time series."],
    limitations: [
      ...(context.synthetic ? ["Synthetic demonstration clip. It validates the software path, not real-world tree assessment."] : []),
      ...analysis.warnings,
      "Projected pixels are not physical displacement without scale and camera calibration.",
      "One video cannot measure hidden decay, anchorage, probability of failure, or a safe wind threshold.",
      "Motion magnitude and frequency alone do not rank structural safety. No failure probability or certified tree-risk rating is produced.",
    ],
  };
}

export function reportText(analysis: Analysis, context: FieldContext, brief: Brief, ai?: { summary: string; observations: string[]; questions: string[]; captureAdvice: string[] } | null) {
  return ["ARBORPULSE | INSPECTION EVIDENCE BRIEF", context.name, context.location || "Location not supplied", `Source: ${context.synthetic ? "synthetic demo" : "user recording"}`, `Queue: ${brief.priority}`, "", brief.summary, "", "MEASURED EVIDENCE", ...brief.evidence.map(s => `• ${s}`), "", "RECORDER NOTES", context.notes || "No notes supplied.", "", "NEXT STEPS", ...brief.nextSteps.map(s => `• ${s}`), ...(ai ? ["", "MUSE SPARK ASSISTED NOTES (review required)", ai.summary, ...ai.observations.map(s => `• ${s}`), "Questions for site inspection:", ...ai.questions.map(s => `• ${s}`), "Capture advice:", ...ai.captureAdvice.map(s => `• ${s}`)] : []), "", "LIMITATIONS", ...brief.limitations.map(s => `• ${s}`), "", `Engine: ${analysis.engine}`, `Report created: ${new Date().toISOString()}`].join("\n");
}
