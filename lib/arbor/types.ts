export type Box = { x: number; y: number; width: number; height: number };
export type MotionSample = { t: number; treeX: number; treeY: number; cameraX: number; cameraY: number; x: number; y: number; quality: number };
export type SpectrumBin = { hz: number; power: number };
export type Analysis = {
  schemaVersion: "1.0"; engine: string; duration: number; sampleRate: number; width: number; height: number;
  samples: MotionSample[]; spectrum: SpectrumBin[]; frequency: number | null; spectralConcentration: number;
  amplitude: number; rms: number; cameraRms: number; coverage: number; usable: boolean; warnings: string[];
  treeBox: Box; referenceBox: Box;
};
export type FieldContext = { name: string; location: string; notes: string; target: "none" | "occasional" | "frequent"; concern: boolean; synthetic: boolean };
export type Brief = { priority: "Review first" | "Standard review" | "Recapture"; summary: string; evidence: string[]; nextSteps: string[]; limitations: string[] };
export type AIBrief = { summary: string; observations: string[]; questions: string[]; captureAdvice: string[] };
export type Recording = FieldContext & { id: string; source: string; poster: string; species: string; treeBox: Box; referenceBox: Box };
