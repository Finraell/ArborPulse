import { withCaptureWarning } from "@/lib/arbor/signal";
import { reportRequestSchema, remeasure } from "@/lib/arbor/contracts";
import { requestMetaBriefWithReceipt } from "@/lib/arbor/meta";
import { json, metaError, metaGate, readBoundedJson } from "@/lib/arbor/http";
export async function POST(request: Request) {
  const gate = metaGate(request); if (gate) return gate;
  try {
    const body = reportRequestSchema.parse(await readBoundedJson(request));
    const analysis = withCaptureWarning(remeasure(body.analysis), body.context.captureWarning);
    if (body.frames.some(frame => frame.t > analysis.duration + .1)) throw new Error("INVALID_SERIES");
    return json(await requestMetaBriefWithReceipt(analysis, body.context, body.frames, process.env.MODEL_API_KEY!, process.env.META_MODEL));
  } catch (error) { return metaError(error); }
}
