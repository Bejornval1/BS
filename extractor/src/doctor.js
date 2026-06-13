/**
 * doctor — preflight check. Verifies the environment can actually run an
 * extraction before you point it at a site. Invoked via `design-extract doctor`.
 */
import { existsSync } from "node:fs";

const ok = (m) => console.log(`  \x1b[32m✔\x1b[0m ${m}`);
const warn = (m) => console.log(`  \x1b[33m!\x1b[0m ${m}`);
const bad = (m) => console.log(`  \x1b[31m✖\x1b[0m ${m}`);

export async function doctor() {
  console.log("\ndesign-extract doctor\n");
  let blocking = 0;

  // 1. Node version
  const major = parseInt(process.versions.node.split(".")[0], 10);
  if (major >= 18) ok(`Node ${process.versions.node}`);
  else { bad(`Node ${process.versions.node} — need ≥ 18. Try: brew install node`); blocking++; }

  // 2. Playwright + Chromium browser binary
  let chromium;
  try {
    ({ chromium } = await import("playwright"));
    ok("playwright installed");
  } catch {
    bad("playwright not installed — run: npm install");
    blocking++;
  }
  if (chromium) {
    let execPath = "";
    try { execPath = chromium.executablePath(); } catch { /* not resolvable */ }
    if (execPath && existsSync(execPath)) {
      ok("Chromium browser present");
    } else {
      bad("Chromium not downloaded — run: npx playwright install chromium");
      blocking++;
    }
  }

  // 3. Optional AI step
  try {
    await import("@anthropic-ai/sdk");
    ok("@anthropic-ai/sdk installed (--ai available)");
  } catch {
    warn("@anthropic-ai/sdk not installed — optional, only needed for --ai (npm i @anthropic-ai/sdk)");
  }
  if (process.env.ANTHROPIC_API_KEY) ok("ANTHROPIC_API_KEY is set");
  else warn("ANTHROPIC_API_KEY not set — only needed for --ai");

  console.log("");
  if (blocking === 0) {
    ok("Ready. Try:  design-extract https://example.com");
    console.log("");
    return true;
  }
  bad(`${blocking} blocking issue(s) above — fix them, then re-run: design-extract doctor\n`);
  process.exitCode = 1;
  return false;
}
