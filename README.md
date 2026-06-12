# NIVALIS — *Between the Frost and the Stars*

A cinematic, single-page website built in the spirit of [igloo.inc](https://www.igloo.inc/) — its
award-winning preloader, smooth-scroll choreography, pinned scroll-scenes, split-text
reveals and grain-soaked dark palette — reimagined around an original concept:
**a colossal monolith of ice suspended in the interstellar void**. Mystical winter
meets *Interstellar*.

> *"In the silence between galaxies, the frost remembers everything light forgets."*

## ✦ What's inside

| Element | Detail |
| --- | --- |
| **Preloader** | Animated 0→100 counter with shifting status phases and an `expo.inOut` curtain reveal. |
| **Smooth scroll** | [Lenis](https://github.com/darkroomengineering/lenis) synced to GSAP `ScrollTrigger`. |
| **Particle field** | Custom `<canvas>` starfield + drifting snow with parallax that follows the pointer. |
| **Custom cursor** | Difference-blend ring with magnetic buttons and link-hover expansion. |
| **Scroll choreography** | Char-by-char hero title, line/word reveals, word-brightening manifesto, parallax layers. |
| **Pinned scene** | "The Monolith" chapter with a scroll-scrubbed image scale. |
| **Horizontal gallery** | "The Frontier" pins and scrolls sideways through the frozen world. |
| **Codex** | Hover-reactive numbered principles. |
| **Gateway / CTA** | Parallax portal, split-text headline, signal-capture form. |
| **Footer** | Giant drifting wordmark marquee, index, coordinates and a live UTC clock. |

Respects `prefers-reduced-motion` and falls back gracefully without JS libraries.

## ✦ Media

All imagery and the hero video were generated with AI (Google **Nano Banana Pro** for
stills, **Hailuo 2.3** for the hero video) and are served from a permanent CDN. Swap any
of them by editing the URLs in `index.html`; the hero video URL lives in the `MEDIA`
config at the top of `assets/js/main.js`.

## ✦ Run it

It's a static site — no build step.

```bash
# any static server works
python3 -m http.server 8000
# then open http://localhost:8000
```

Or deploy straight to Netlify (`netlify.toml` included) — set publish directory to `.`.

## ✦ Structure

```
index.html              # markup + section content
assets/css/style.css    # full visual system + tokens
assets/js/main.js        # preloader, canvas, cursor, GSAP scroll engine
assets/favicon.svg
netlify.toml
```

## ✦ Stack

Vanilla HTML / CSS / JS · GSAP + ScrollTrigger · Lenis · Fraunces / Space Grotesk / Space Mono.

---

*A recreation made in the spirit of the frost — not affiliated with igloo.inc.*
