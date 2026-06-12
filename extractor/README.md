# design-extract

A **render-first website design extractor**. Point it at a URL and it renders the
page in a real headless browser, then pulls out the *design system* — screenshots,
a clustered color palette, the type scale, spacing/radii/shadows, the real
image/font/video assets, the detected motion stack, and the section structure —
and (optionally) feeds all of that to Claude to generate a recreation.

Built the same way a designer would reverse-engineer a site, but automated.

## Why "render-first"

Modern sites are JS-heavy — `curl` returns an empty shell. This tool runs the page
with Playwright, scrolls it to trigger lazy-loading and scroll animations, and only
*then* reads the computed result. That's the difference between extracting a real
design system and scraping markup.

## Install

```bash
cd extractor
npm install          # also runs `playwright install chromium`
```

## Use

```bash
# Deterministic extraction (screenshots + tokens + assets)
node bin/extract.js https://example.com

# With the Claude recreation step
ANTHROPIC_API_KEY=sk-ant-... node bin/extract.js https://example.com --ai
```

### Options

| Flag | Default | Description |
| --- | --- | --- |
| `--out <dir>` | `extracted/<host>` | Output directory |
| `--viewports <list>` | `1440x900,390x844` | Comma list of `WxH` to screenshot |
| `--no-assets` | off | Skip downloading images/fonts/video |
| `--ai` | off | Run the Claude recreation (needs `ANTHROPIC_API_KEY`) |
| `--ai-model <id>` | `claude-opus-4-8` | Model for the AI step |
| `--timeout <ms>` | `60000` | Navigation timeout |

## Output

```
extracted/<host>/
  full.png                 full-page screenshot
  viewport-1440x900.png    per-viewport screenshots (desktop + mobile)
  viewport-390x844.png
  sections/section-NN.png  per-section crops (great input for a vision model)
  assets/                  the real images, fonts, and video the page loaded
  design-tokens.json       full machine-readable record
  tokens.css               :root CSS custom properties
  tailwind.config.js       theme.extend stub
  report.html              ← open this: visual summary of everything
  recreation.html          (with --ai) Claude's rebuild, seeded with real tokens
```

## What gets extracted

- **Palette** — every painted color is harvested from `getComputedStyle`, weighted
  by painted area, then reduced to a clean 8-swatch palette via weighted k-means.
  Each swatch is tagged (`surface-light`, `surface-dark`, `accent`, `text`).
- **Typography** — font families + the weight/size scale, ranked by usage.
- **Spacing / radii / shadows** — the most frequent values, as scales.
- **Assets** — captured from the network layer (catches lazy-loaded and
  CSS-`background` images that DOM scraping misses) and saved locally.
- **Motion stack** — detects GSAP, ScrollTrigger, Lenis, Locomotive, Three.js,
  Framer Motion, Barba, SplitType, Swiper, Lottie via globals + script URLs.
- **Fonts** — `@font-face` rules captured from same-origin stylesheets.
- **Structure** — a simplified section/landmark outline + page meta/OG.

## Architecture

```
bin/extract.js     CLI
src/extractor.js   orchestrator: launch → scroll → capture → harvest → write
src/harvest.js     in-page computed-style harvester (frequency maps)
src/palette.js     weighted k-means color clustering
src/report.js      emits tokens.css / tailwind.config.js / report.html / JSON
src/ai.js          Claude vision → self-contained HTML recreation
```

The AI step uses the official `@anthropic-ai/sdk`, sends the viewport screenshot as
a vision input plus the extracted tokens as the ground-truth brief, and streams a
single self-contained HTML document back (model defaults to `claude-opus-4-8`).

## Anti-bot reality

Premium sites often block automation (datacenter IPs, `navigator.webdriver`). This
tool ships a real User-Agent and a light `webdriver` mask, which clears most checks.
For sites behind aggressive protection, add a residential proxy (Playwright
`launch({ proxy })`) and the `playwright-extra` stealth plugin.

## ⚠️ Use responsibly

Extract for **analysis and inspiration**, not pixel-cloning someone's brand into
production. Respect `robots.txt` and terms of service. Downloaded fonts and imagery
are usually licensed — use them to understand the design, then source your own.
