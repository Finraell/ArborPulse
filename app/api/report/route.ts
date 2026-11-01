import { z } from "zod";
import { requestMetaBrief } from "@/lib/arbor/meta";
import { summarize } from "@/lib/arbor/signal";
import { boxesOverlap } from "@/lib/arbor/video";

const box = z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1), width: z.number().min(.03).max(1), height: z.number().min(.03).max(1) }).refine(b => b.x + b.width <= 1.001 && b.y + b.height <= 1.001);
const sample = z.object({ t: z.number().min(0).max(60), treeX: z.number().min(-2000).max(2000), treeY: z.number().min(-2000).max(2000), cameraX: z.number().min(-2000).max(2000), cameraY: z.number().min(-2000).max(2000), x: z.number().min(-4000).max(4000), y: z.number().min(-4000).max(4000), quality: z.number().min(0).max(1) });
const bodySchema = z.object({ consent: z.literal(true), context: z.object({ name: z.string().min(1).max(150), location: z.string().max(200), notes: z.string().max(2000), target: z.enum(["none", "occasional", "frequent"]), concern: z.boolean(), synthetic: z.boolean() }), analysis: z.object({ samples: z.array(sample).min(72).max(600), width: z.number().int().min(160).max(1920), height: z.number().int().min(120).max(1920), treeBox: box, referenceBox: box }), frames: z.array(z.string().max(130000).regex(/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/)).max(3) }).strict();

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return Response.json({ error: "Cross-origin report requests are not allowed." }, { status: 403 });
  if (!process.env.MODEL_API_KEY) return Response.json({ error: "AI briefs are not connected yet. The measured evidence and local report are available.", code: "META_NOT_CONFIGURED" }, { status: 503 });
  try {
    const declared = Number(request.headers.get("content-length") || 0);
    if (declared > 650000) return Response.json({ error: "Report request is too large." }, { status: 413 });
    // Bound streamed input as well as Content-Length (which clients may omit).
    const reader = request.body?.getReader();
    if (!reader) return Response.json({ error: "Missing report body." }, { status: 400 });
    const chunks: Uint8Array[] = []; let size = 0;
    while (true) { const part = await reader.read(); if (part.done) break; size += part.value.byteLength; if (size > 650000) { await reader.cancel(); return Response.json({ error: "Report request is too large." }, { status: 413 }); } chunks.push(part.value); }
    const bytes = new Uint8Array(size); let at = 0; for (const chunk of chunks) { bytes.set(chunk, at); at += chunk.length; }
    const body = bodySchema.parse(JSON.parse(new TextDecoder().decode(bytes)));
    const a = body.analysis;
    if (boxesOverlap(a.treeBox, a.referenceBox)) throw new Error("INVALID_SERIES");
    for (let i = 0; i < a.samples.length; i++) {
      const s = a.samples[i];
      if (Math.abs(s.x - (s.treeX - s.cameraX)) > .01 || Math.abs(s.y - (s.treeY - s.cameraY)) > .01) throw new Error("INVALID_SERIES");
      if (i > 0 && (s.t <= a.samples[i - 1].t || Math.abs((s.t - a.samples[i - 1].t) - (a.samples[1].t - a.samples[0].t)) > .002)) throw new Error("INVALID_SERIES");
    }
    const analysis = summarize(a.samples, a.width, a.height, a.treeBox, a.referenceBox);
    const brief = await requestMetaBrief(analysis, body.context, body.frames, process.env.MODEL_API_KEY, process.env.META_MODEL);
    return Response.json({ brief, provider: "Meta Model API", model: process.env.META_MODEL || "muse-spark-1.3", generatedAt: new Date().toISOString() }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (error instanceof z.ZodError || error instanceof SyntaxError || message === "INVALID_SERIES") return Response.json({ error: "Invalid evidence data. Run the motion scan again." }, { status: 400 });
    return Response.json({ error: message === "META_RATE_LIMIT" ? "Meta is busy. Try the AI brief again shortly." : message === "META_AUTH" ? "Meta access needs attention. Your local evidence brief remains available." : "The AI brief could not be completed. Your local evidence brief remains available." }, { status: message === "META_RATE_LIMIT" ? 429 : 502 });
  }
}
