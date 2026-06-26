# FrameHouse — Production Spec Sheet

**Release:** Brand logo refresh + Hunter of the Night artwork + blank-card cleanup
**Date:** 2026-06-26
**Owner:** Bejornval1 / TSDC Films
**Status:** Code merged & pushed · Awaiting production deploy

---

## 1. Summary of changes

| # | Change | Type | User-facing impact |
|---|--------|------|--------------------|
| 1 | Replaced legacy gold "house" emblem with the official **FrameHouse wordmark** | Brand | New logo in header, footer, hero badge, and login |
| 2 | Added **Hunter of the Night** poster artwork (`hunter-night`) | Content | Film now shows real art on cards, rows, and detail backdrop |
| 3 | **Hid all films without poster artwork** and dropped creators left with none | Content/UX | No blank gradient placeholder cards anywhere |

---

## 2. Asset specifications

### Logo (FrameHouse wordmark)
- **Format:** PNG, transparent background (embedded base64 data URI, `var LOGO`)
- **Source render:** 908 × 144 px (tight-cropped to glyphs), ~119 KB
- **Aspect ratio:** ~6.3 : 1 (wide wordmark vs. old ~0.68 portrait emblem)
- **Render heights (inline, `width:auto`):** header 28px · footer 30px · hero badge 28px (mobile 24px) · login 48px

### Hunter of the Night poster
- **Format:** JPEG, progressive, quality 84 (embedded base64 in `POSTERS['hunter-night']`)
- **Dimensions:** 500 × 750 px (2:3 poster ratio), ~50 KB
- **Usage:** card thumbnail, carousel art, and faded detail-page backdrop

---

## 3. Content rules

- **Visibility rule:** `films = films.filter(hasArt)` — only films with a `POSTERS[id]` entry are surfaced.
- **Creator rule:** creators whose film list becomes empty after filtering are removed; remaining creators have their `filmIds` pruned to live films only.
- **Removed from view (no artwork):** At the Register, The Real Deal Convo, Pressure (TSDC); Lagos After Dark, Low Tide (Maya); Cordillera, Salt & Light (Diego); Signal, Ember (Aria).
- **Removed creators:** Maya Okonkwo, Diego Salvatierra, Aria Lindqvist.
- **Reversible:** restoring a film is just adding its `POSTERS` entry — no data deleted from the `films`/`creators` source arrays.

---

## 4. Repository / build

| Item | Value |
|------|-------|
| Repo | `Bejornval1/BS` |
| App source | `framehouse-demo.html` (single self-contained file) |
| Entry / redirect | `index.html` → `framehouse-demo.html` · `.nojekyll` present |
| App branch | `claude/framehouse-hero-layout-bc6gew` |
| Release commit | `f412d48` |
| Build command | none (static) |
| Publish dir | repo root (or staged `_site/` with the 3 static files) |

---

## 5. Deployment

| Item | Value |
|------|-------|
| Host | Netlify |
| Site | `framehouse-demo` |
| Site ID | `5a6f00fb-ac09-445b-8784-8ed3457cc13f` |
| Production URL | https://framehouse-demo.netlify.app/ |
| CI workflow | `.github/workflows/deploy.yml` (manual `workflow_dispatch`) on default branch |
| Required secrets | `NETLIFY_AUTH_TOKEN`, `NETLIFY_SITE_ID` |

**Dispatch command:**
```bash
gh workflow run deploy.yml --repo Bejornval1/BS \
  --ref claude/netlify-mcp-setup-ntMhP \
  -f branch=claude/framehouse-hero-layout-bc6gew
```

---

## 6. QA / verification

Rendered and confirmed (no console errors) at 1440px and 390px:
- [x] New wordmark logo: header, footer, hero badge, login — sized correctly, no overflow/distortion
- [x] Hunter of the Night: card art, row art, detail-page backdrop
- [x] No blank gradient placeholder cards on Landing, Browse, or detail rows
- [x] Creator Spotlight shows only creators with live films (TS, JR, DC, KJ, RF, NP)
- [x] Mobile header wordmark fits alongside menu / Sign in

---

## 7. Known constraints

- Production deploy must run on GitHub's runners (or a networked machine); the sandboxed dev environment is blocked from uploading to Netlify (403 at the egress proxy).
- Repo default branch is `claude/netlify-mcp-setup-ntMhP`; point any Netlify auto-deploy at `claude/framehouse-hero-layout-bc6gew`.
