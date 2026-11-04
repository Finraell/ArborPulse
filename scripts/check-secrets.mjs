import { execFileSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
const paths = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z"], { encoding: "utf8" }).split("\0").filter(Boolean);
const issues = [];
let checked = 0, missing = 0;
for (const path of new Set(paths)) {
  if (/^(?:.*\/)?(?:\.dev\.vars(?:\..*)?|\.env(?:\.local|\.production|\.development)?|id_rsa)$/.test(path) && !path.endsWith(".example")) { issues.push(`${path}: credential file must not be tracked`); continue; }
  // Git still lists tracked paths deleted from the working tree.
  const stats = statSync(path, { throwIfNoEntry: false });
  if (!stats) { missing++; continue; }
  if (!stats.isFile() || /\.(?:mp4|webm|jpg|jpeg|png|gif|woff2?|pdf|zip|gz)$/i.test(path) || stats.size > 2000000) continue;
  const content = readFileSync(path, "utf8");
  checked++;
  if (/LLM_\d{8,}_[A-Za-z0-9_-]{20,}/.test(content) || /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(content)) issues.push(`${path}: possible credential pattern (value hidden)`);
}
if (issues.length) { console.error(issues.join("\n")); process.exit(1); }
console.log(`Secret check passed for ${checked} text files; ${missing} missing tracked paths skipped. Credential values were not printed.`);
