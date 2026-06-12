/**
 * harvestTokens — serialized into the page via page.evaluate().
 * Walks every element, tallies computed-style values into frequency maps.
 * Returns plain JSON (frequency maps), so all clustering happens Node-side.
 *
 * Keep this function self-contained: it must serialize cleanly to the browser.
 */
export function harvestTokens() {
  const colors = {};   // "r,g,b" (opaque) -> weighted count
  const fonts = {};     // "family | weight | size" -> count
  const spacing = {};   // px string -> count
  const radii = {};     // border-radius -> count
  const shadows = {};   // box-shadow -> count

  const bump = (obj, key, w = 1) => {
    if (key == null) return;
    obj[key] = (obj[key] || 0) + w;
  };

  // Normalise any CSS color to "r,g,b" (drop fully transparent).
  const toRGB = (c) => {
    if (!c) return null;
    const m = c.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const parts = m[1].split(",").map((s) => parseFloat(s.trim()));
    const [r, g, b, a = 1] = parts;
    if (a === 0) return null;
    if ([r, g, b].some((n) => Number.isNaN(n))) return null;
    return `${Math.round(r)},${Math.round(g)},${Math.round(b)}`;
  };

  const all = document.querySelectorAll("*");
  const total = all.length || 1;

  for (const el of all) {
    const s = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    const area = Math.max(1, rect.width * rect.height);
    // Weight background colors by painted area so the dominant surface wins.
    const areaWeight = Math.min(40, 1 + area / 40000);

    const bg = toRGB(s.backgroundColor);
    if (bg) bump(colors, bg, areaWeight);

    const fg = toRGB(s.color);
    if (fg) bump(colors, fg, 1);

    const bc = toRGB(s.borderTopColor);
    if (bc && parseFloat(s.borderTopWidth) > 0) bump(colors, bc, 0.5);

    // Typography — only count elements that actually render text.
    if (el.childNodes.length && hasText(el)) {
      const fam = (s.fontFamily || "").split(",")[0].replace(/["']/g, "").trim();
      if (fam) bump(fonts, `${fam} | ${s.fontWeight} | ${s.fontSize}`);
    }

    for (const p of ["marginTop", "marginBottom", "paddingTop", "paddingBottom", "gap", "rowGap", "columnGap"]) {
      const v = s[p];
      if (v && v !== "0px" && v !== "normal" && /px$/.test(v)) bump(spacing, v);
    }
    if (s.borderRadius && s.borderRadius !== "0px") bump(radii, s.borderRadius);
    if (s.boxShadow && s.boxShadow !== "none") bump(shadows, s.boxShadow);
  }

  function hasText(el) {
    for (const n of el.childNodes) {
      if (n.nodeType === 3 && n.textContent.trim().length > 1) return true;
    }
    return false;
  }

  return { colors, fonts, spacing, radii, shadows, elementCount: total };
}
