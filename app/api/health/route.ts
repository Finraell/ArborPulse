export function GET() {
  return Response.json({ status: "ok", version: "0.1.0", engine: "PhysicsLens", metaConfigured: Boolean(process.env.MODEL_API_KEY), model: process.env.META_MODEL || "muse-spark-1.3" }, { headers: { "Cache-Control": "no-store" } });
}
