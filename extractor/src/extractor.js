/**
 * Orchestrates a render-first extraction:
 *   launch → navigate → autoscroll → capture (screenshots + assets) →
 *   harvest computed styles → detect motion/fonts → analyse → write outputs.
 */
import { chromium } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";
import { harvestTokens } from "./harvest.js";
import { buildPalette } from "./palette.js";
import { writeOutputs } from "./report.js";
import { recreate } from "./ai.js";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const log = (...m) => console.log("  ›", ...m);

export async function extract(opts) {
  const url = normalizeUrl(opts.url);
  const host = new URL(url).hostname.replace(/^www\./, "");
  const outDir = path.resolve(opts.out || path.join("extracted", host));
  const assetsDir = path.join(outDir, "assets");
  await fs.mkdir(assetsDir, { recursive: true });

  const viewports = parseViewports(opts.viewports);
  console.log(`\n● Extracting ${url}`);
  console.log(`  output → ${outDir}\n`);

  const browser = await chromium.launch({
    args: ["--disable-blink-features=AutomationControlled"],
  });
  const context = await browser.newContext({
    userAgent: UA,
    viewport: viewports[0],
    deviceScaleFactor: 1,
    bypassCSP: true,
  });
  // Light stealth: hide the obvious webdriver tell.
  await context.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => undefined });
  });

  const page = await context.newPage();

  // ---- 1. Capture every asset the page actually loads ----
  const assets = [];
  const seen = new Set();
  if (opts.assets) {
    page.on("response", async (res) => {
      try {
        const type = res.request().resourceType();
        if (!["image", "media", "font"].includes(type)) return;
        if (!res.ok()) return;
        const u = res.url();
        if (seen.has(u) || u.startsWith("data:")) return;
        seen.add(u);
        const buf = await res.body().catch(() => null);
        if (!buf || buf.length === 0) return;
        const name = safeName(u, assets.length);
        await fs.writeFile(path.join(assetsDir, name), buf);
        assets.push({ url: u, type, file: `assets/${name}`, bytes: buf.length });
      } catch { /* ignore individual asset failures */ }
    });
  }

  // ---- 2. Navigate + settle ----
  log("navigating…");
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: opts.timeout });
  await page.waitForLoadState("networkidle", { timeout: opts.timeout }).catch(() => {});
  await autoScroll(page);
  await page.waitForTimeout(800);

  // ---- 3. Screenshots ----
  log("capturing screenshots…");
  await page.screenshot({ path: path.join(outDir, "full.png"), fullPage: true }).catch(() => {});
  for (const vp of viewports) {
    await page.setViewportSize(vp);
    await page.waitForTimeout(400);
    await page
      .screenshot({ path: path.join(outDir, `viewport-${vp.width}x${vp.height}.png`) })
      .catch(() => {});
  }
  await page.setViewportSize(viewports[0]);

  // Per-section crops — far better input for a vision model than one tall image.
  const sections = await captureSections(page, outDir);

  // ---- 4. Harvest computed styles + structure (runs in the page) ----
  log("harvesting design tokens…");
  const raw = await page.evaluate(harvestTokens);

  // ---- 5. Motion stack + @font-face + meta (runs in the page) ----
  const meta = await page.evaluate(detectMeta);

  await browser.close();

  // ---- 6. Analyse (Node side) ----
  log("clustering palette…");
  const palette = buildPalette(raw.colors);

  const design = {
    url,
    extractedAt: new Date().toISOString(),
    viewports,
    palette,
    typography: rankTypography(raw.fonts),
    spacing: topN(raw.spacing, 14),
    radii: topN(raw.radii, 10),
    shadows: topN(raw.shadows, 10),
    fonts: meta.fontFaces,
    motion: meta.motion,
    structure: meta.structure,
    sections,
    assets: { count: assets.length, items: assets.slice(0, 400) },
    pageMeta: meta.page,
  };

  // ---- 7. Write outputs ----
  log("writing tokens + report…");
  await writeOutputs(outDir, design);

  // ---- 8. Optional AI recreation ----
  if (opts.ai) {
    log("running AI recreation (Claude)…");
    try {
      const heroShot = path.join(outDir, `viewport-${viewports[0].width}x${viewports[0].height}.png`);
      const html = await recreate({ design, screenshotPath: heroShot, model: opts.aiModel });
      await fs.writeFile(path.join(outDir, "recreation.html"), html);
      log("→ recreation.html");
    } catch (err) {
      console.warn("  ! AI step skipped:", err.message);
    }
  }

  console.log(`\n✔ Done. ${assets.length} assets, ${palette.length} palette colors.`);
  console.log(`  Open ${path.join(outDir, "report.html")}\n`);
  return outDir;
}

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

function normalizeUrl(u) {
  if (!/^https?:\/\//i.test(u)) return "https://" + u;
  return u;
}

function parseViewports(s) {
  return s
    .split(",")
    .map((p) => p.trim().split("x").map(Number))
    .filter((a) => a.length === 2 && a.every(Number.isFinite))
    .map(([width, height]) => ({ width, height }));
}

function safeName(u, i) {
  let base = "";
  try {
    base = new URL(u).pathname.split("/").pop() || "";
  } catch { /* noop */ }
  base = base.split("?")[0].replace(/[^\w.\-]/g, "_");
  if (!base || !base.includes(".")) base = `asset-${i}`;
  return `${String(i).padStart(3, "0")}-${base}`.slice(0, 80);
}

async function autoScroll(page) {
  await page
    .evaluate(async () => {
      await new Promise((resolve) => {
        let y = 0;
        const step = Math.max(200, window.innerHeight * 0.8);
        const timer = setInterval(() => {
          window.scrollBy(0, step);
          y += step;
          if (y >= document.body.scrollHeight) {
            clearInterval(timer);
            window.scrollTo(0, 0);
            setTimeout(resolve, 300);
          }
        }, 250);
      });
    })
    .catch(() => {});
}

async function captureSections(page, outDir) {
  const dir = path.join(outDir, "sections");
  await fs.mkdir(dir, { recursive: true });
  const boxes = await page
    .evaluate(() => {
      const out = [];
      const candidates = document.querySelectorAll(
        "body > *, main > *, section, header, footer"
      );
      let i = 0;
      for (const el of candidates) {
        const r = el.getBoundingClientRect();
        if (r.height < 120 || r.width < 200) continue;
        out.push({
          i: i++,
          tag: el.tagName.toLowerCase(),
          id: el.id || null,
          cls: (el.className && typeof el.className === "string" ? el.className : "")
            .split(/\s+/).slice(0, 3).join(" "),
          top: r.top + window.scrollY,
          height: Math.min(r.height, 4000),
        });
      }
      return out.slice(0, 16);
    })
    .catch(() => []);

  const results = [];
  for (const b of boxes) {
    const file = `sections/section-${String(b.i).padStart(2, "0")}.png`;
    try {
      await page.screenshot({
        path: path.join(outDir, file),
        clip: { x: 0, y: b.top, width: page.viewportSize().width, height: b.height },
      });
      results.push({ ...b, file });
    } catch { /* clip out of range */ }
  }
  return results;
}

function topN(map, n) {
  return Object.entries(map)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([value, count]) => ({ value, count }));
}

function rankTypography(fontMap) {
  // fontMap keys look like "family | weight | size"
  const families = {};
  const ranked = topN(fontMap, 24);
  for (const { value, count } of ranked) {
    const fam = value.split("|")[0].trim();
    families[fam] = (families[fam] || 0) + count;
  }
  return {
    families: Object.entries(families)
      .sort((a, b) => b[1] - a[1])
      .map(([family, count]) => ({ family, count })),
    styles: ranked.map(({ value, count }) => {
      const [family, weight, size] = value.split("|").map((s) => s.trim());
      return { family, weight, size, count };
    }),
  };
}

// Runs inside the page — collects the motion stack, @font-face rules, structure, meta.
function detectMeta() {
  const scripts = [...document.scripts].map((s) => s.src).filter(Boolean);
  const has = (re) => scripts.some((s) => re.test(s));
  const motion = {
    gsap: !!window.gsap || has(/gsap/i),
    scrollTrigger: !!(window.ScrollTrigger || (window.gsap && window.gsap.ScrollTrigger)),
    lenis: !!window.Lenis || has(/lenis/i),
    locomotive: has(/locomotive/i),
    three: !!window.THREE || has(/three(\.min)?\.js/i),
    framerMotion: has(/framer-motion|motion/i) || !!document.querySelector("[data-framer-name]"),
    barba: has(/barba/i),
    splitting: has(/split(ting|type)/i),
    swiper: !!window.Swiper || has(/swiper/i),
    lottie: !!window.lottie || has(/lottie/i),
    scripts: scripts.slice(0, 60),
  };

  const fontFaces = [];
  for (const sheet of document.styleSheets) {
    let rules;
    try { rules = sheet.cssRules; } catch { continue; } // cross-origin
    if (!rules) continue;
    for (const r of rules) {
      if (r.constructor && r.constructor.name === "CSSFontFaceRule") {
        fontFaces.push(r.cssText);
      }
    }
  }

  const structure = [];
  const top = document.querySelectorAll("body > *, main > section, section, header, footer");
  let i = 0;
  for (const el of top) {
    if (i++ > 30) break;
    structure.push({
      tag: el.tagName.toLowerCase(),
      id: el.id || null,
      role: el.getAttribute("role") || null,
      classes: (typeof el.className === "string" ? el.className : "").slice(0, 120),
    });
  }

  const m = (n) => document.querySelector(`meta[name="${n}"]`)?.content || null;
  const og = (p) => document.querySelector(`meta[property="og:${p}"]`)?.content || null;

  return {
    motion,
    fontFaces: fontFaces.slice(0, 40),
    structure,
    page: {
      title: document.title,
      description: m("description") || og("description"),
      ogImage: og("image"),
      themeColor: m("theme-color"),
      lang: document.documentElement.lang || null,
    },
  };
}
