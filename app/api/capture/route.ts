import { captureRequestSchema } from "@/lib/arbor/contracts";
import { requestCapturePlan } from "@/lib/arbor/meta";
import { json, metaError, metaGate, readBoundedJson } from "@/lib/arbor/http";
export async function POST(request: Request) {
  const gate = metaGate(request); if (gate) return gate;
  try {
    const body = captureRequestSchema.parse(await readBoundedJson(request));
    return json(await requestCapturePlan(body.context, body.frames, process.env.MODEL_API_KEY!, process.env.META_MODEL, fetch, body.targetTreeBox));
  } catch (error) { return metaError(error); }
}
