import { execFileSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
const paths = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z"], { encoding: "utf8" }).split("\0").filter(Boolean);
const issues = [];
for (const path of new Set(paths)) {
  if (/^(?:.*\/)?(?:\.dev\.vars(?:\..*)?|\.env(?:\.local|\.production|\.development)?|id_rsa)$/.test(path) && !path.endsWith(".example")) { issues.push(`${path}: credential file must not be tracked`); continue; }
  if (/\.(?:mp4|webm|jpg|jpeg|png|gif|woff2?|pdf|zip|gz)$/i.test(path) || statSync(path).size > 2000000) continue;
  const content = readFileSync(path, "utf8");
  if (/LLM_\d{8,}_[A-Za-z0-9_-]{20,}/.test(content) || /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(content)) issues.push(`${path}: possible credential pattern (value hidden)`);
}
if (issues.length) { console.error(issues.join("\n")); process.exit(1); }
console.log(`Secret check passed for ${new Set(paths).size} candidate source files. Credential values were not printed.`);
