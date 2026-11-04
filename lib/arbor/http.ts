import { z } from "zod";
import { MetaResponseError } from "./meta";

const headers = { "Cache-Control": "no-store" };
export function json(value: unknown, status = 200) { return Response.json(value, { status, headers }); }
export function metaGate(request: Request): Response | null {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return json({ error: "Cross-origin AI requests are not allowed." }, 403);
  if (!process.env.MODEL_API_KEY) return json({ error: "Meta is not configured. Run pnpm setup:local and set the key in your local .dev.vars file. Local measurements remain available.", code: "META_NOT_CONFIGURED" }, 503);
  return null;
}
export async function readBoundedJson(request: Request, maxBytes = 1000000) {
  if (Number(request.headers.get("content-length") || 0) > maxBytes) throw new Error("BODY_TOO_LARGE");
  const reader = request.body?.getReader();
  if (!reader) throw new Error("INVALID_SERIES");
  const chunks: Uint8Array[] = []; let size = 0;
  while (true) {
    const part = await reader.read(); if (part.done) break;
    size += part.value.byteLength;
    if (size > maxBytes) { await reader.cancel(); throw new Error("BODY_TOO_LARGE"); }
    chunks.push(part.value);
  }
  const bytes = new Uint8Array(size); let at = 0;
  for (const chunk of chunks) { bytes.set(chunk, at); at += chunk.length; }
  return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
}
export function metaError(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (message === "BODY_TOO_LARGE") return json({ error: "The AI request is too large." }, 413);
  if (error instanceof z.ZodError || error instanceof SyntaxError || message === "INVALID_SERIES") return json({ error: "Invalid evidence data. Sample the recording again." }, 400);
  if (message === "LOCAL_RATE_LIMIT") return json({ error: "The local hourly AI request limit was reached. You can continue measuring videos without AI." }, 429);
  if (message === "META_RATE_LIMIT") return json({ error: "Meta is busy. Try again shortly; no automatic retry was made." }, 429);
  if (message === "META_AUTH") return json({ error: "Meta access was rejected. Check the local key and model access in your Meta project." }, 502);
  if (message === "META_BILLING") return json({ error: "Meta requires billing or eligible API credits for this project. Check the project that owns your key." }, 502);
  if (error instanceof MetaResponseError) {
    const descriptions: Record<string, string> = {
      META_TRUNCATED: "Meta reached the response token limit before completing the brief.",
      META_INVALID_JSON: "Meta returned incomplete or invalid JSON.",
      META_INVALID_RESPONSE: "Meta's response did not match the requested report structure.",
      META_UNKNOWN_EVIDENCE: "Meta returned an unknown reference or mixed evidence categories.",
      META_INVALID_REGION: "Meta proposed overlapping or invalid regions.",
      META_TARGET_CHANGED: "Meta proposed a different tree. Keep your selected regions or inspect again.",
      META_REFERENCE_CHANGED: "Meta proposed a reference outside your selected region. Your manual regions are unchanged; keep them or inspect again.",
      META_UPSTREAM: "Meta rejected the request or could not complete it.",
    };
    console.warn("ArborPulse Meta response rejected", { code: message, diagnostics: error.diagnostics });
    return json({ error: `${descriptions[message] || "The Meta response could not be verified."} [${message}] Your measured evidence remains available.`, code: message, diagnostics: error.diagnostics }, 502);
  }
  return json({ error: "The Meta response could not be verified. Your measured evidence remains available; retry only when ready." }, 502);
}
