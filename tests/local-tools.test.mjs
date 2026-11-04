import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, unlinkSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync, spawnSync } from "node:child_process";
import { checkMetaAccess } from "../scripts/meta-check.mjs";

const scanner = fileURLToPath(new URL("../scripts/check-secrets.mjs", import.meta.url));
function repository(run) {
  const directory = mkdtempSync(path.join(tmpdir(), "arborpulse tools "));
  try {
    execFileSync("git", ["init", "--quiet"], { cwd: directory });
    run(directory);
  } finally { rmSync(directory, { recursive: true, force: true }); }
}
const scan = cwd => spawnSync(process.execPath, [scanner], { cwd, encoding: "utf8" });
test("secret scan tolerates a tracked template deleted from a working tree", () => repository(directory => {
  writeFileSync(path.join(directory, ".env.example"), "MODEL_API_KEY=\n");
  execFileSync("git", ["add", ".env.example"], { cwd: directory });
  unlinkSync(path.join(directory, ".env.example"));
  const result = scan(directory);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /1 missing tracked paths skipped/);
}));
test("missing files do not stop secret detection in the remaining source", () => repository(directory => {
  writeFileSync(path.join(directory, ".env.example"), "MODEL_API_KEY=\n");
  execFileSync("git", ["add", ".env.example"], { cwd: directory });
  unlinkSync(path.join(directory, ".env.example"));
  const secret = "LLM_" + "12345678_" + "a".repeat(24);
  writeFileSync(path.join(directory, "config.ts"), `export const key = '${secret}';`);
  const result = scan(directory);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /config.ts: possible credential/);
  assert.ok(!result.stderr.includes(secret));
}));
test("ignored local key configuration stays outside the scan, tracked credentials still fail", () => repository(directory => {
  writeFileSync(path.join(directory, ".gitignore"), ".dev.vars\n");
  writeFileSync(path.join(directory, ".dev.vars"), "MODEL_API_KEY=fixture-only-secret\n");
  assert.equal(scan(directory).status, 0);
  execFileSync("git", ["add", "--force", ".dev.vars"], { cwd: directory });
  assert.equal(scan(directory).status, 1);
}));
test("a verified Meta check retains whitelisted usage and never exposes the key", async () => {
  const key = "fixture-only-meta-key";
  const result = await checkMetaAccess(key, undefined, async (_url, request) => {
    assert.equal(request.headers.Authorization, `Bearer ${key}`);
    return Response.json({ id: "fixture-not-live", model: "muse-spark-1.3", choices: [{ finish_reason: "stop", message: { content: "ARBORPULSE_OK" } }], usage: { prompt_tokens: 20, completion_tokens: 24, total_tokens: 44, completion_tokens_details: { reasoning_tokens: 16 }, private_extra: key } });
  });
  assert.equal(result.ok, true);
  assert.equal(result.receipt.usage.reasoning_tokens, 16);
  assert.ok(!JSON.stringify(result).includes(key));
});
test("reasoning-only truncation is diagnosed without claiming verification or spending on retries", async () => {
  let calls = 0;
  const result = await checkMetaAccess("fixture-only-key", undefined, async () => {
    calls++;
    return Response.json({ choices: [{ finish_reason: "length", message: { content: "", reasoning_content: "private internal text" } }], usage: { completion_tokens: 512, completion_tokens_details: { reasoning_tokens: 512 } } });
  });
  assert.equal(calls, 1);
  assert.equal(result.ok, false);
  assert.equal(result.diagnostics.finishReason, "length");
  assert.equal(result.diagnostics.visibleCharacters, 0);
  assert.equal(result.diagnostics.reasoning_tokens, 512);
  assert.ok(!JSON.stringify(result).includes("private internal text"));
});
test("unexpected or rejected provider replies return useful diagnostics without raw response bodies", async () => {
  const unexpected = await checkMetaAccess("fixture-only-key", undefined, async () => Response.json({ choices: [{ finish_reason: "stop", message: { content: "private unexpected answer" } }] }));
  assert.equal(unexpected.ok, false);
  assert.equal(unexpected.diagnostics.visibleCharacters, 25);
  assert.ok(!JSON.stringify(unexpected).includes("private unexpected answer"));
  const denied = await checkMetaAccess("fixture-only-key", undefined, async () => new Response("private provider detail", { status: 401 }));
  assert.equal(denied.ok, false);
  assert.equal(denied.diagnostics.httpStatus, 401);
  assert.match(denied.message, /local key/);
  assert.ok(!JSON.stringify(denied).includes("private provider detail"));
});
