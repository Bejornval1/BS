/**
 * recreate — optional AI step. Feeds the extracted design tokens + a viewport
 * screenshot to Claude (vision) and asks for a single self-contained HTML
 * recreation seeded with the real palette, type scale, and motion stack.
 *
 * Requires ANTHROPIC_API_KEY and the optional @anthropic-ai/sdk dependency.
 */
import fs from "node:fs/promises";

export async function recreate({ design, screenshotPath, model = "claude-opus-4-8" }) {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not set");
  }
  let Anthropic;
  try {
    ({ default: Anthropic } = await import("@anthropic-ai/sdk"));
  } catch {
    throw new Error("Install @anthropic-ai/sdk to use --ai (npm i @anthropic-ai/sdk)");
  }

  const client = new Anthropic();
  const imgB64 = await fs.readFile(screenshotPath).then((b) => b.toString("base64"));

  const brief = summarize(design);
  const system =
    "You are a senior creative front-end engineer. You reproduce the visual " +
    "design language of a reference site — layout, palette, typography, spacing, " +
    "and motion feel — as clean, original, production-quality code. You never " +
    "copy proprietary text or imagery verbatim; you rebuild the system.";

  const userText =
    `Recreate the look and feel of this web page as a SINGLE self-contained HTML file ` +
    `(inline <style>, vanilla JS, CDN libraries allowed). Use the extracted design ` +
    `tokens below as ground truth and match the screenshot's composition.\n\n` +
    `Return ONLY the HTML document — no commentary, no markdown fences.\n\n` +
    `=== EXTRACTED DESIGN TOKENS ===\n${brief}\n`;

  // Stream because the output is a full HTML document (long).
  const stream = client.messages.stream({
    model,
    max_tokens: 64000,
    thinking: { type: "adaptive" },
    output_config: { effort: "high" },
    system,
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: "image/png", data: imgB64 } },
          { type: "text", text: userText },
        ],
      },
    ],
  });

  const final = await stream.finalMessage();
  const text = final.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("");

  return stripFences(text);
}

function summarize(d) {
  const pal = d.palette.map((c) => `${c.hex} (${c.role})`).join(", ");
  const fams = d.typography.families.map((f) => f.family).join(", ");
  const styles = d.typography.styles
    .slice(0, 6)
    .map((t) => `${t.family} ${t.weight}/${t.size}`)
    .join("; ");
  const motion = Object.entries(d.motion)
    .filter(([k, v]) => k !== "scripts" && v)
    .map(([k]) => k)
    .join(", ") || "none";
  const spacing = d.spacing.slice(0, 8).map((s) => s.value).join(", ");
  const sections = d.structure
    .map((s) => `${s.tag}${s.id ? "#" + s.id : ""}`)
    .slice(0, 14)
    .join(" → ");
  return [
    `URL: ${d.url}`,
    `Title: ${d.pageMeta.title || ""}`,
    `Palette: ${pal}`,
    `Type families: ${fams}`,
    `Type styles: ${styles}`,
    `Spacing scale: ${spacing}`,
    `Radii: ${d.radii.slice(0, 5).map((r) => r.value).join(", ") || "0"}`,
    `Motion stack: ${motion}`,
    `Section flow: ${sections}`,
  ].join("\n");
}

function stripFences(s) {
  const t = s.trim();
  const fence = t.match(/```(?:html)?\s*([\s\S]*?)```/i);
  return (fence ? fence[1] : t).trim();
}
