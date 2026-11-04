export type Box = { x: number; y: number; width: number; height: number };
export type EvidenceFrame = { id: string; t: number; url: string };
export type EvidenceFinding = { text: string; source: "frame" | "measurement" | "field_note"; refs: string[] };
export type AIReceipt = { provider: "Meta Model API"; model: string; requestId: string | null; createdAt: string; inputTokens: number | null; outputTokens: number | null; cachedInputTokens: number; estimatedUsd: number | null; promptVersion: string };
export type CapturePlan = { summary: string; treeBox: Box; referenceBox: Box; treeReason: string; referenceReason: string; checks: { severity: "info" | "recapture"; text: string; frameIds: string[] }[]; questions: string[] };
export type CapturePlanEvidence = { plan: CapturePlan; receipt: AIReceipt; frames: EvidenceFrame[] };
export type MotionSample = { t: number; treeX: number; treeY: number; cameraX: number; cameraY: number; x: number; y: number; quality: number };
export type SpectrumBin = { hz: number; power: number };
export type Analysis = {
  schemaVersion: "1.0"; engine: string; duration: number; sampleRate: number; width: number; height: number;
  samples: MotionSample[]; spectrum: SpectrumBin[]; frequency: number | null; spectralConcentration: number;
  amplitude: number; rms: number; cameraRms: number; coverage: number; usable: boolean; warnings: string[];
  treeBox: Box; referenceBox: Box;
  frequencyResolution?: number; frequencyAxis?: "horizontal" | "vertical"; longestDropout?: number;
};
export type FieldContext = { name: string; location: string; notes: string; target: "none" | "occasional" | "frequent"; concern: boolean; synthetic: boolean; attribution?: string; sourceUrl?: string; mediaLicense?: string; captureWarning?: string };
export type Brief = { priority: "Review first" | "Standard review" | "Recapture"; summary: string; evidence: string[]; nextSteps: string[]; limitations: string[] };
export type AIBrief = { summary: string; observations: string[]; questions: string[]; captureAdvice: string[]; findings?: EvidenceFinding[] };
export type Recording = FieldContext & { id: string; source: string; poster: string; species: string; treeBox: Box; referenceBox: Box; durationLabel?: string; attribution?: string; sourceUrl?: string };
