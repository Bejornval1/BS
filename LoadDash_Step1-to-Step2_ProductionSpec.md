# LoadDash — Production Spec: Step 1 → Step 2

**Project:** LoadDash explainer ("oner" — one continuous camera move across step scenes)
**Comp:** `Main Comp` · 1920×1080 · 23.976 fps · Classic 3D renderer
**Scope of this sheet:** Scene 1 (Step 1) through Scene 2 (Step 2) — setup, camera handoff, and the full Step 2 element build.
**Status legend:** ✅ done · 🔶 in progress · ⬜ pending

---

## 1. Concept

LoadDash is built as a **single continuous camera move** ("oner"): the scenes live side-by-side and a virtual camera travels between them, so each step reads as one unbroken shot. Each scene has **its own camera**; the active camera at any frame is the **topmost enabled camera layer** whose in/out range covers the current time. That rule is what makes the Scene 1 → Scene 2 handoff seamless.

---

## 2. Technical setup ✅

| Setting | Value |
|---|---|
| Master comp | `Main Comp` |
| Resolution | 1920 × 1080 |
| Frame rate | 23.976 fps |
| Renderer | Classic 3D |
| Camera model | One camera per scene; topmost-active-camera handoff |
| Backgrounds | `Navy Blue Paper`, `Vanilla Paper` (2D full-frame, shared across scenes) |

### Camera handoff (Scene 1 → Scene 2) ✅
`Camera 2` picks up exactly where `Camera 1` ends and crabs to the Step 2 framing. It is anchored to the scene marker layers so it always frames the right region:

```js
// Camera 2 — Position
s1  = thisComp.layer("Step 1").transform.position[0];
cy  = thisComp.layer("Step 1").transform.position[1];
s2  = thisComp.layer("Step 2").transform.position[0];
s2y = thisComp.layer("Step 2").transform.position[1];
tCrabStart = 26; tCrabEnd = 28; camX2 = s2 + 960 - s1;
var x,y,z;
if (time < tCrabStart) { x = 960; y = cy; z = -2666.67; }
else if (time < tCrabEnd) {
  x = ease(time, tCrabStart, tCrabEnd, 960, camX2);
  y = ease(time, tCrabStart, tCrabEnd, cy, s2y);
  z = -2666.67;
} else { x = camX2; y = s2y; z = -2666.67; }
[x, y, z]

// Camera 2 — Point of Interest
p = transform.position; [p[0], p[1], 0]
```
- Evaluated hold (Scene 2): position ≈ **[2976, 540.7, −2666.67]**, zoom **2666.7**, straight-on (no tilt).
- With `z = −zoom`, world units = screen px at z=0 → visible frame ≈ **x 2016–3936, y 0–1080**.
- ⚠️ **Coupling note:** the `Step 1` / `Step 2` PNG layers double as the camera's anchors. Moving them shifts the camera. If Step 2 needs to be freely repositioned, re-point the camera at a dedicated anchor null first.

---

## 3. Scene 1 — Step 1 ✅ (locked, summarized)

Step 1 card + text beats ("book it.", "LOAD IT.", "gone.", "How loaddash works", "two photos", "that's all it takes", numbered beats 1–6), over the navy/vanilla paper. Scene 1 holds until the camera begins its crab at **26s** and completes the handoff to Scene 2 by **28s**. (Detailed Step 1 timing owned by the Scene 1 sheet.)

---

## 4. Transition: Step 1 → Step 2 ✅

| Beat | Time | What happens |
|---|---|---|
| Scene 1 hold | …–26.0s | Camera 1 framing on Step 1 |
| **Crab** | 26.0 → 28.0s | Camera eases from Step 1 to Step 2 framing (horizontal truck, flat, no swing) |
| Scene 2 hold | 28.0s → | Camera 2 settled on the Step 2 region |

Background (navy paper) carries across for free — it's a 2D full-frame layer shared by both scenes.

---

## 5. Scene 2 — Step 2: "Choose your items"

**Coordinate model (decision):** Step 2's card + items are authored in **flat 2D screen space** (1920×1080). The card sits at a screen position (212.9, 576.4); the items animate within the frame. (Camera-independent; see §2 coupling note for how this interacts with the 3D camera build.)

### 5.1 Element list

| Element | Layer | Behavior | Status |
|---|---|---|---|
| Background | `Navy Blue Paper` | 2D full-frame, unchanged from Scene 1 | ✅ |
| Card 2 | `Step 2` (PNG) | 2D, **50% scale**, position **212.9, 576.4** (left) — the reference screen | 🔶 |
| Title | `STEP 2` (text) | Animates in (slide + fade), top/right | 🔶 |
| Prompt | `pick your items` (text) | Animates in under the title | 🔶 |
| Items ×6 | `loaddash_item_*` (PNG) | Fly in from right → form ring → orbit ×2 → land in 2×3 grid | 🔶 |
| Selection | Pen circles | Hand-drawn circle highlight around each landed item | ⬜ |

### 5.2 Item motion — the core mechanic

Each item carries **one Position expression** that plays its whole journey; only `i` (ring slot) and `fx, fy` (final grid spot) change per item.

**Phases & timing**

| Phase | Window | Motion |
|---|---|---|
| Parked | …–28.8s | Off-screen right (ring center x + 900) |
| Fly in | 28.8 → 29.4s | Eases left, items assemble into a ring |
| Orbit | 29.4 → 31.4s | Ring spins **2 full smooth turns** (720°), eased |
| Land | 31.4 → 32.4s | Each peels off the ring → eases to its grid spot |
| Settled | 32.4s → | Held in the 2×3 grid (with a small scale overshoot on land) |

**Ring/grid params (2D screen space):** ring center `Cx=1250, Cy=540`, radius `R=240`, `N=6`, item scale `35%`, park-offset `900`.

**The expression (per item):**
```js
var Cx=1250, Cy=540, R=240, N=6, off=900;
var i=<SLOT>, fx=<GRID_X>, fy=<GRID_Y>;
var tIn=28.8, tForm=29.4, tOrbitEnd=31.4, tLand=32.4;
var base=i*2*Math.PI/N, twoTurns=2*2*Math.PI;
var ringX=Cx+R*Math.cos(base), ringY=Cy+R*Math.sin(base);
var px,py;
if (time<tIn){ px=(Cx+off)+R*Math.cos(base); py=ringY; }
else if (time<tForm){ var cx=ease(time,tIn,tForm,Cx+off,Cx); px=cx+R*Math.cos(base); py=ringY; }
else if (time<tOrbitEnd){ var a=base+ease(time,tForm,tOrbitEnd,0,twoTurns); px=Cx+R*Math.cos(a); py=Cy+R*Math.sin(a); }
else if (time<tLand){ px=ease(time,tOrbitEnd,tLand,ringX,fx); py=ease(time,tOrbitEnd,tLand,ringY,fy); }
else { px=fx; py=fy; }
[px,py]
```
Optional polish: **self-spin** on Rotation `ease(time,29.4,31.4,0,360*2)`; **settle bounce** on Scale (8% sin overshoot 32.4–32.7s); **stagger** entrance via `i*0.08`.

### 5.3 The 2×3 landing grid

| Item layer | Ring slot `i` | Grid `fx, fy` | Spot |
|---|---|---|---|
| `loaddash_item_yard-debris` | 5 | 1000, 380 | top-left |
| `loaddash_item_other` | 4 | 1280, 380 | top-center |
| `loaddash_item_bagged-trash` | 0 | 1560, 380 | top-right |
| `loaddash_item_donation` | 2 | 1000, 700 | bottom-left |
| `loaddash_item_furniture` | 3 | 1280, 700 | bottom-center |
| `loaddash_item_cardboard` | 1 | 1560, 700 | bottom-right |

*(Grid X/Y are screen-space; tune freely. Original spec authored an alternate world-space grid — see repo history if reverting to the 3D-camera model.)*

---

## 6. Master timing (Step 1 → Step 2)

| Time | Event |
|---|---|
| 26.0s | Camera begins crab from Step 1 |
| 27.8–28.5s | Step 2 title + prompt animate in |
| 28.0s | Camera settled on Step 2 |
| 28.8s | Items begin flying in from the right |
| 29.4s | Ring formed |
| 29.4–31.4s | Ring orbits 2 full turns |
| 31.4–32.4s | Items peel off and land in the 2×3 grid |
| 32.4s+ | Items settled; pen-circle highlights (manual) follow |

---

## 7. Assets

- **Cards:** `Step 1`, `Step 2` (… `Step 6`) — PNG
- **Items:** `loaddash_item_yard-debris`, `_other`, `_bagged-trash`, `_donation`, `_furniture`, `_cardboard` — PNG
- **Backgrounds:** `Navy Blue Paper`, `Vanilla Paper` — PNG
- **Highlight:** `Amber Highlight` — PNG
- **Audio:** `Step 1 Audio`, `Whoosh 01.wav`, `mouse-click.wav`, `Paper Sound`, `Marker on paper`, `soundja...roll_main-02.mp3`, `Documen...arimba_main.wav`

---

## 8. Build & execution method

The Step 2 element build is delivered as an **ExtendScript** file, `build_step2_elements.jsx`, versioned in the repo (`bejornval1/bs`, branch `claude/inspiring-euler-da9iB`). It is non-destructive: it finds existing layers by name and applies expressions/values; it never duplicates, renames, or deletes layers, and is safe to re-run.

**Two ways to run it:**
1. **In After Effects:** make `Main Comp` active → `File ▸ Scripts ▸ Run Script File…` → pick the `.jsx`.
2. **Via the AfterEffects MCP (Claude Desktop on the Mac):** paste the script and say *"run via the after-effects MCP."* (The MCP only executes where After Effects is running — i.e. the Desktop app on the same machine, with the `mcp-bridge-auto.jsx` panel open and "Allow Scripts to Write Files and Access Network" enabled. It is **not** reachable from the cloud Claude Code session.)

**Tunable knobs (top of the script):** `CARD_SCALE`, `CARD_POS`, `Cx/Cy/R`, `ITEM_SCALE`, `PARK_OFF`, the `ITEMS` grid spots, and the `tIn/tForm/tOrbitEnd/tLand` timing.

---

## 9. Status & open items

- ✅ Camera system + Scene 1→2 handoff
- ✅ Item motion mechanic (fly-in → ring → orbit ×2 → land) — rendering correctly in frame
- 🔶 Card 2 final placement (50% @ 212.9,576.4) — confirm framing
- 🔶 Title + prompt text — copy, font, exact placement
- 🔶 Grid spacing / item scale — fine-tune so items don't overlap and read cleanly
- ⬜ Pen-circle selection highlights (per item)
- ⬜ Item-specific entrance timing/stagger, SFX sync (whoosh on fly-in, click on select)

---

## 10. Next steps

1. Confirm Card 2 placement + title/prompt copy and position.
2. Lock item scale + grid spacing.
3. Add pen-circle selection highlight pass.
4. Sync SFX (whoosh on fly-in, marker/click on selection).
5. Proceed to Scene 3 using the same per-scene camera + element pattern.
