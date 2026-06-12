/**
 * buildPalette — turn the weighted "r,g,b" frequency map into a clean,
 * deduplicated palette via weighted k-means in RGB space.
 */
const toHex = (r, g, b) =>
  "#" + [r, g, b].map((n) => Math.round(n).toString(16).padStart(2, "0")).join("");

const luminance = (r, g, b) => (0.2126 * r + 0.7152 * g + 0.114 * b) / 255;

export function buildPalette(colorMap, k = 8) {
  const points = Object.entries(colorMap).map(([key, w]) => {
    const [r, g, b] = key.split(",").map(Number);
    return { r, g, b, w };
  });
  if (points.length === 0) return [];
  if (points.length <= k) {
    return points
      .sort((a, b) => b.w - a.w)
      .map((p) => swatch(p.r, p.g, p.b, p.w));
  }

  // Seed centroids from the highest-weight, most-distinct colors (k-means++ lite).
  const sorted = [...points].sort((a, b) => b.w - a.w);
  const centroids = [sorted[0]];
  for (const p of sorted) {
    if (centroids.length >= k) break;
    const far = centroids.every((c) => dist(c, p) > 1600); // ~40 per channel
    if (far) centroids.push(p);
  }
  while (centroids.length < k) centroids.push(sorted[centroids.length % sorted.length]);

  let cs = centroids.map((c) => ({ r: c.r, g: c.g, b: c.b }));
  for (let iter = 0; iter < 12; iter++) {
    const sums = cs.map(() => ({ r: 0, g: 0, b: 0, w: 0 }));
    for (const p of points) {
      let best = 0, bd = Infinity;
      for (let i = 0; i < cs.length; i++) {
        const d = dist(cs[i], p);
        if (d < bd) { bd = d; best = i; }
      }
      const s = sums[best];
      s.r += p.r * p.w; s.g += p.g * p.w; s.b += p.b * p.w; s.w += p.w;
    }
    cs = sums.map((s, i) =>
      s.w === 0 ? cs[i] : { r: s.r / s.w, g: s.g / s.w, b: s.b / s.w }
    );
    // carry weights for output ordering
    cs.forEach((c, i) => (c.w = sums[i].w));
  }

  return cs
    .filter((c) => c.w > 0)
    .sort((a, b) => b.w - a.w)
    .map((c) => swatch(c.r, c.g, c.b, c.w));
}

function swatch(r, g, b, w) {
  const L = luminance(r, g, b);
  const sat = saturation(r, g, b);
  let role = "neutral";
  if (L > 0.92) role = "surface-light";
  else if (L < 0.12) role = "surface-dark";
  else if (sat > 0.35) role = "accent";
  else role = "text";
  return {
    hex: toHex(r, g, b),
    rgb: [Math.round(r), Math.round(g), Math.round(b)],
    weight: Math.round(w),
    luminance: +L.toFixed(3),
    role,
  };
}

const dist = (a, b) =>
  (a.r - b.r) ** 2 + (a.g - b.g) ** 2 + (a.b - b.b) ** 2;

function saturation(r, g, b) {
  const max = Math.max(r, g, b) / 255;
  const min = Math.min(r, g, b) / 255;
  if (max === 0) return 0;
  return (max - min) / max;
}
