/**
 * writeOutputs — emit the extraction in four shapes:
 *   design-tokens.json   full machine-readable record
 *   tokens.css           :root CSS custom properties
 *   tailwind.config.js   theme.extend stub
 *   report.html          visual summary you can open in a browser
 */
import fs from "node:fs/promises";
import path from "node:path";

export async function writeOutputs(outDir, design) {
  await fs.writeFile(
    path.join(outDir, "design-tokens.json"),
    JSON.stringify(design, null, 2)
  );
  await fs.writeFile(path.join(outDir, "tokens.css"), cssVars(design));
  await fs.writeFile(path.join(outDir, "tailwind.config.js"), tailwind(design));
  await fs.writeFile(path.join(outDir, "report.html"), reportHtml(design));
}

function cssVars(d) {
  const lines = [":root {"];
  d.palette.forEach((c, i) => lines.push(`  --color-${c.role}-${i}: ${c.hex};`));
  d.spacing.slice(0, 10).forEach((s, i) => lines.push(`  --space-${i}: ${s.value};`));
  d.radii.slice(0, 6).forEach((r, i) => lines.push(`  --radius-${i}: ${r.value};`));
  d.typography.families.slice(0, 4).forEach((f, i) =>
    lines.push(`  --font-${i}: "${f.family}";`));
  lines.push("}");
  return lines.join("\n") + "\n";
}

function tailwind(d) {
  const colors = {};
  d.palette.forEach((c, i) => (colors[`${c.role}-${i}`] = c.hex));
  const fontFamily = {};
  d.typography.families.slice(0, 4).forEach((f, i) => (fontFamily[`x${i}`] = [f.family]));
  return (
    "/** @type {import('tailwindcss').Config} */\n" +
    "export default " +
    JSON.stringify({ theme: { extend: { colors, fontFamily } } }, null, 2) +
    ";\n"
  );
}

const esc = (s) =>
  String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

function reportHtml(d) {
  const swatches = d.palette
    .map(
      (c) => `<div class="sw"><div class="chip" style="background:${c.hex}"></div>
      <code>${c.hex}</code><span>${c.role} · ${c.weight}</span></div>`
    )
    .join("");

  const type = d.typography.styles
    .slice(0, 8)
    .map(
      (t) =>
        `<p style="font-family:'${esc(t.family)}',serif;font-weight:${esc(t.weight)};font-size:clamp(14px,${esc(t.size)},48px)">${esc(t.family)} ${esc(t.weight)} / ${esc(t.size)}</p>`
    )
    .join("");

  const motion = Object.entries(d.motion)
    .filter(([k, v]) => k !== "scripts" && v)
    .map(([k]) => `<span class="tag">${k}</span>`)
    .join("") || "<em>none detected</em>";

  const assetThumbs = d.assets.items
    .filter((a) => a.type === "image")
    .slice(0, 24)
    .map((a) => `<img loading="lazy" src="${esc(a.file)}" title="${esc(a.url)}" />`)
    .join("");

  const sectionShots = d.sections
    .map((s) => `<figure><img loading="lazy" src="${esc(s.file)}" /><figcaption>${esc(s.tag)}${s.id ? "#" + esc(s.id) : ""}</figcaption></figure>`)
    .join("");

  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Design Extract — ${esc(d.url)}</title>
<style>
  :root{color-scheme:dark}
  body{margin:0;background:#0c0d10;color:#e7e9ee;font:15px/1.5 ui-sans-serif,system-ui,sans-serif}
  header{padding:2rem clamp(1rem,4vw,3rem);border-bottom:1px solid #23252c}
  header h1{margin:0 0 .25rem;font-size:1.4rem}
  header a{color:#7db3ff}
  main{padding:clamp(1rem,4vw,3rem);max-width:1200px;margin:0 auto;display:grid;gap:3rem}
  h2{font-size:.8rem;letter-spacing:.18em;text-transform:uppercase;color:#9aa0ae;margin:0 0 1rem}
  .palette{display:flex;flex-wrap:wrap;gap:1rem}
  .sw{display:flex;flex-direction:column;gap:.3rem;width:120px}
  .chip{height:72px;border-radius:10px;border:1px solid #2a2c34}
  .sw code{font-size:.8rem}.sw span{font-size:.7rem;color:#8b909c}
  .tag{display:inline-block;background:#1a2540;color:#9cc4ff;border:1px solid #294067;border-radius:99px;padding:.25em .8em;font-size:.75rem;margin:0 .4rem .4rem 0}
  .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:.6rem}
  .grid img{width:100%;height:90px;object-fit:cover;border-radius:8px;background:#16181d;border:1px solid #23252c}
  .sections{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:1rem}
  .sections img{width:100%;border-radius:8px;border:1px solid #23252c}
  figcaption{font-size:.72rem;color:#8b909c;margin-top:.3rem;font-family:ui-monospace,monospace}
  .meta{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:1rem;font-size:.85rem}
  .meta div{background:#14161b;border:1px solid #23252c;border-radius:10px;padding:1rem}
  .meta b{display:block;color:#9aa0ae;font-weight:500;font-size:.72rem;text-transform:uppercase;letter-spacing:.1em;margin-bottom:.3rem}
</style></head><body>
<header>
  <h1>Design Extract</h1>
  <a href="${esc(d.url)}">${esc(d.url)}</a> · <span style="color:#8b909c">${esc(d.extractedAt)}</span>
</header>
<main>
  <section><h2>Palette</h2><div class="palette">${swatches}</div></section>
  <section><h2>Typography</h2>${type}
    <div style="margin-top:1rem;color:#8b909c;font-size:.8rem">Families: ${d.typography.families.map((f) => esc(f.family)).join(" · ")}</div>
  </section>
  <section><h2>Motion stack</h2>${motion}</section>
  <section><h2>Sections</h2><div class="sections">${sectionShots || "<em>none</em>"}</div></section>
  <section><h2>Assets (${d.assets.count})</h2><div class="grid">${assetThumbs || "<em>none</em>"}</div></section>
  <section><h2>Meta</h2><div class="meta">
    <div><b>Title</b>${esc(d.pageMeta.title || "")}</div>
    <div><b>Description</b>${esc(d.pageMeta.description || "")}</div>
    <div><b>Theme color</b>${esc(d.pageMeta.themeColor || "—")}</div>
    <div><b>Spacing scale</b>${d.spacing.slice(0, 8).map((s) => esc(s.value)).join(" · ")}</div>
    <div><b>Radii</b>${d.radii.slice(0, 6).map((r) => esc(r.value)).join(" · ") || "—"}</div>
    <div><b>@font-face</b>${d.fonts.length} rules captured</div>
  </div></section>
</main></body></html>`;
}
