import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { parseEnv } from "node:util";
import { fileURLToPath } from "node:url";
import { spawn, spawnSync } from "node:child_process";
import { checkMetaAccess } from "./meta-check.mjs";
const root = fileURLToPath(new URL("../", import.meta.url));
process.chdir(root);
const command = process.argv[2] || "doctor";
const allowed = ["MODEL_API_KEY", "META_MODEL", "META_MAX_REQUESTS_PER_HOUR"];
function config() {
  const values = existsSync(".dev.vars") ? parseEnv(readFileSync(".dev.vars", "utf8")) : {};
  return Object.fromEntries(allowed.map(name => [name, process.env[name] || values[name] || ""]));
}
function trackedCredential() {
  const result = spawnSync("git", ["ls-files", "--error-unmatch", ".dev.vars"], { encoding: "utf8", stdio: "pipe" });
  return result.status === 0;
}
function ignoredCredential() {
  return spawnSync("git", ["check-ignore", "--quiet", ".dev.vars"], { stdio: "pipe" }).status === 0;
}
if (command === "setup") {
  if (!existsSync(".dev.vars")) {
    writeFileSync(".dev.vars", '# Local only. Never commit or upload this file.\nMODEL_API_KEY=""\nMETA_MODEL="muse-spark-1.3"\nMETA_MAX_REQUESTS_PER_HOUR="20"\n', { mode: 0o600, flag: "wx" });
    console.log("Created .dev.vars with a blank key. Set your own Meta key in your editor.");
  } else console.log("Existing .dev.vars preserved. No values were printed or replaced.");
  console.log("Next: pnpm local:doctor, pnpm meta:check, pnpm local");
} else if (command === "doctor") {
  const values = config();
  console.log(`Node ${process.versions.node}; dependencies ${existsSync("node_modules/vite") ? "installed" : "missing"}`);
  console.log(`Local .dev.vars: ${existsSync(".dev.vars") ? "present" : "missing (run pnpm setup:local)"}`);
  console.log(`Server key: ${values.MODEL_API_KEY ? "configured (value hidden)" : "not set"}`);
  console.log(`Model: ${values.META_MODEL || "muse-spark-1.3"}; hourly process cap: ${values.META_MAX_REQUESTS_PER_HOUR || 20}`);
  console.log(`Credential file ignored by Git: ${ignoredCredential() ? "yes" : "not confirmed"}`);
  if (trackedCredential()) { console.error("Stop: .dev.vars is tracked by Git. Remove it from version control before running."); process.exitCode = 1; }
} else if (command === "start") {
  if (trackedCredential()) throw new Error("Refusing to start with a tracked .dev.vars credential file.");
  const values = config();
  if (!values.MODEL_API_KEY) console.log("Meta key is not set. Measurements and local reports will still work.");
  console.log("ArborPulse local server: http://localhost:5173 (loopback only)");
  const child = spawn(process.execPath, ["scripts/run-framework.mjs", "dev", "--host", "127.0.0.1", "--port", "5173"], { cwd: root, env: { ...process.env, ...values }, stdio: "inherit" });
  child.on("exit", code => process.exit(code || 0));
  for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
} else if (command === "check") {
  const values = config(), key = values.MODEL_API_KEY, model = values.META_MODEL || "muse-spark-1.3";
  if (!key) { console.error("No local Meta key configured. Set it in .dev.vars; never paste it into GitHub."); process.exit(1); }
  const result = await checkMetaAccess(key, model);
  if (!result.ok) {
    console.error(result.message);
    console.error(JSON.stringify(result.diagnostics, null, 2));
    process.exitCode = 1;
  } else console.log(JSON.stringify({ ...result.receipt, diagnostics: result.diagnostics }, null, 2));
} else throw new Error("Use setup, doctor, start, or check.");
