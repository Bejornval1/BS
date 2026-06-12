#!/usr/bin/env node
/**
 * design-extract — CLI entry point.
 *
 * Usage:
 *   design-extract <url> [options]
 *
 * Options:
 *   --out <dir>         Output directory (default: ./extracted/<hostname>)
 *   --viewports <list>  Comma list of WxH viewports (default: 1440x900,390x844)
 *   --no-assets         Skip downloading images/fonts/video
 *   --ai                Run the Claude recreation step (needs ANTHROPIC_API_KEY)
 *   --ai-model <id>     Model for the AI step (default: claude-opus-4-8)
 *   --timeout <ms>      Navigation timeout (default: 60000)
 *   --help
 */
import { extract } from "../src/extractor.js";

function parseArgs(argv) {
  const args = { url: null, viewports: "1440x900,390x844", out: null,
    assets: true, ai: false, aiModel: "claude-opus-4-8", timeout: 60000 };
  const rest = argv.slice(2);
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    switch (a) {
      case "--help": case "-h": args.help = true; break;
      case "--no-assets": args.assets = false; break;
      case "--ai": args.ai = true; break;
      case "--out": args.out = rest[++i]; break;
      case "--viewports": args.viewports = rest[++i]; break;
      case "--ai-model": args.aiModel = rest[++i]; break;
      case "--timeout": args.timeout = parseInt(rest[++i], 10); break;
      default:
        if (!a.startsWith("-") && !args.url) args.url = a;
        else console.warn(`Unknown option: ${a}`);
    }
  }
  return args;
}

const HELP = `
design-extract — render-first website design extractor

  design-extract <url> [options]

Options:
  --out <dir>         Output directory (default: ./extracted/<hostname>)
  --viewports <list>  Comma list of WxH (default: 1440x900,390x844)
  --no-assets         Skip downloading images/fonts/video
  --ai                Run the Claude recreation step (needs ANTHROPIC_API_KEY)
  --ai-model <id>     Model for the AI step (default: claude-opus-4-8)
  --timeout <ms>      Navigation timeout (default: 60000)
  --help

Example:
  design-extract https://example.com --ai
`;

const args = parseArgs(process.argv);
if (args.help || !args.url) {
  console.log(HELP);
  process.exit(args.url ? 0 : 1);
}

extract(args).catch((err) => {
  console.error("\n✖ Extraction failed:", err?.stack || err);
  process.exit(1);
});
