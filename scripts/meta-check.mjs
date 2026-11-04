const MAX_COMPLETION_TOKENS = 512;
const count = value => Number.isFinite(value) && value >= 0 ? value : null;
const label = value => typeof value === "string" ? value.slice(0, 160) : null;

/** One explicit connectivity check. Never logs credentials or response text. */
export async function checkMetaAccess(key, model = "muse-spark-1.3", fetcher = fetch) {
  let response;
  try {
    response = await fetcher("https://api.meta.ai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model, reasoning_effort: "minimal", max_completion_tokens: MAX_COMPLETION_TOKENS, messages: [{ role: "user", content: "Reply with only the exact text ARBORPULSE_OK. Do not add any other text." }] }),
      signal: AbortSignal.timeout(45000),
    });
  } catch (error) {
    return { ok: false, message: error?.name === "TimeoutError" ? "Meta check timed out. No automatic retry was made." : "Could not reach Meta. Check your connection and HTTPS access; no automatic retry was made.", diagnostics: { httpStatus: null } };
  }
  if (!response.ok) {
    const advice = response.status === 401 || response.status === 403 ? "Check the local key and model access in your Meta project." : response.status === 402 ? "Check billing and eligible credits in the project that owns your key." : response.status === 429 ? "The provider rate limit was reached. Retry only when ready." : "Check model access and provider service status.";
    return { ok: false, message: `Meta check failed (HTTP ${response.status}). ${advice}`, diagnostics: { httpStatus: response.status } };
  }
  let result;
  try { result = await response.json(); }
  catch { return { ok: false, message: "Meta accepted the request but did not return valid JSON.", diagnostics: { httpStatus: response.status } }; }
  const choice = result?.choices?.[0], content = choice?.message?.content;
  const finishReason = ["stop", "length", "tool_calls", "content_filter", "function_call"].includes(choice?.finish_reason) ? choice.finish_reason : "unknown";
  const usage = {
    prompt_tokens: count(result?.usage?.prompt_tokens),
    completion_tokens: count(result?.usage?.completion_tokens),
    total_tokens: count(result?.usage?.total_tokens),
    reasoning_tokens: count(result?.usage?.completion_tokens_details?.reasoning_tokens),
  };
  const diagnostics = { httpStatus: response.status, finishReason, visibleCharacters: typeof content === "string" ? content.length : 0, maxCompletionTokens: MAX_COMPLETION_TOKENS, ...usage };
  if (finishReason === "length") return { ok: false, message: "Meta reached the output-token limit. Reasoning and visible text share that budget. Inspect the token counts below; no automatic retry was made.", diagnostics };
  if (typeof content !== "string" || !content.includes("ARBORPULSE_OK")) return { ok: false, message: "Meta accepted the request, but the connectivity reply could not be verified. Diagnostics omit response text and the key.", diagnostics };
  return { ok: true, receipt: { status: "verified", provider: "Meta Model API", model: label(result.model) || model, requestId: label(result.id) || response.headers.get("x-request-id"), usage }, diagnostics };
}
