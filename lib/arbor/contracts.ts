import { z } from "zod";
import { summarize } from "./signal";
import { boxesOverlap } from "./video";

export const boxSchema = z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1), width: z.number().min(.03).max(1), height: z.number().min(.03).max(1) }).strict().refine(b => b.x + b.width <= 1.001 && b.y + b.height <= 1.001);
export const contextSchema = z.object({ name: z.string().trim().min(1).max(150), location: z.string().max(200), notes: z.string().max(2000), target: z.enum(["none", "occasional", "frequent"]), concern: z.boolean(), synthetic: z.boolean(), attribution: z.string().max(800).optional(), sourceUrl: z.string().url().max(500).optional(), mediaLicense: z.string().max(100).optional(), captureWarning: z.string().max(1000).optional() });
export const frameSchema = z.object({ id: z.string().regex(/^F\d{2}$/), t: z.number().min(0).max(60), url: z.string().max(130000).regex(/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/) }).strict();
export const framesSchema = z.array(frameSchema).max(6).refine(frames => new Set(frames.map(f => f.id)).size === frames.length, "Frame IDs must be unique");
const sample = z.object({ t: z.number().min(0).max(60), treeX: z.number().min(-2000).max(2000), treeY: z.number().min(-2000).max(2000), cameraX: z.number().min(-2000).max(2000), cameraY: z.number().min(-2000).max(2000), x: z.number().min(-4000).max(4000), y: z.number().min(-4000).max(4000), quality: z.number().min(0).max(1) });
export const analysisInputSchema = z.object({ samples: z.array(sample).min(72).max(750), width: z.number().int().min(160).max(1920), height: z.number().int().min(120).max(1920), treeBox: boxSchema, referenceBox: boxSchema });
export const captureRequestSchema = z.object({ consent: z.literal(true), context: contextSchema, frames: framesSchema.refine(f => f.length >= 2, "Two or more frames are required") }).strict();
export const reportRequestSchema = z.object({ consent: z.literal(true), context: contextSchema, analysis: analysisInputSchema, frames: framesSchema }).strict();

export function remeasure(input: z.infer<typeof analysisInputSchema>) {
  if (boxesOverlap(input.treeBox, input.referenceBox)) throw new Error("INVALID_SERIES");
  const times = input.samples;
  for (let i = 0; i < times.length; i++) {
    const s = times[i];
    if (Math.abs(s.x - (s.treeX - s.cameraX)) > .01 || Math.abs(s.y - (s.treeY - s.cameraY)) > .01) throw new Error("INVALID_SERIES");
    if (i && (s.t <= times[i - 1].t || Math.abs((s.t - times[i - 1].t) - (times[1].t - times[0].t)) > .002)) throw new Error("INVALID_SERIES");
  }
  return summarize(input.samples, input.width, input.height, input.treeBox, input.referenceBox);
}
