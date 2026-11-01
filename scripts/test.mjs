import { build } from "vite";
import { execFileSync } from "node:child_process";
import path from "node:path";
await build({ configFile: false, logLevel: "error", resolve: { alias: { "@": process.cwd() } }, build: { ssr: "tests/core.test.ts", outDir: ".test-build", emptyOutDir: true, minify: false } });
execFileSync(process.execPath, ["--test", path.resolve(".test-build/core.test.js")], { stdio: "inherit" });
