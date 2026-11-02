export function GET() {
  return Response.json({ status: "ok", version: "0.2.0", engine: "PhysicsLens", metaConfigured: Boolean(process.env.MODEL_API_KEY), model: process.env.META_MODEL || "muse-spark-1.3", maxRequestsPerHour: Number(process.env.META_MAX_REQUESTS_PER_HOUR || 20), capabilities: ["capture-planning", "local-motion", "grounded-brief", "evidence-export"], liveVerification: "A configured key is not proof of a successful model call; each successful AI result includes its receipt." }, { headers: { "Cache-Control": "no-store" } });
}
