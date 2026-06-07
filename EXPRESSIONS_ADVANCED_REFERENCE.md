# Advanced After Effects Expressions Reference (MCP library)

> Capability reference for driving After Effects through the **AfterEffectsMCP**
> server. Companion to `CAPABILITIES.md` (smooth-camera workflow) and
> `CAMERA_CAPABILITIES.md` (camera attributes). Write every snippet
> **JavaScript-engine-clean** so it applies inline or from a `.jsx` library.

## TL;DR
- **Camera expressions** revolve around `thisComp.activeCamera` plus the `cameraOption` group (`zoom`, `focusDistance`, `aperture`, `blurLevel`, `depthOfField`, iris properties); rack-focus, lookAt orientation, and the zoom↔focal-length relationship (`FilmBack / FocalLength = CompSize / Zoom`) are all expressible, and Adobe's canonical focus-lock recipe is `length(position, pointOfInterest)`.
- The **full expression language** since AE 16.0 (2020) runs on the V8 JavaScript engine (File ▸ Project Settings ▸ Expressions) and is "up to 5x faster" than legacy ExtendScript on render; 2024–2026 added per-character text/paragraph styling (setters noted "added in After Effects 25.0"), variable-font hooks, and the `previousKey()`/`nextKey()` expression methods (After Effects 26.0, first in Beta build 26.0x40). Build the library against the JavaScript engine.
- For an **MCP**, expressions are applied via ExtendScript's `property.expression = "..."` (governed by `expressionEnabled`/`canSetExpression`/`expressionError`); existing servers (Dakkshin `setLayerExpression`, ishu86 `set_expression`) already expose this. Store reusable snippets as `.jsx` expression libraries and `.ffx` animation/behavior presets in named, categorized folders.

## Key Findings

1. **Use the JavaScript engine, always.** AE's expression engine switched from legacy ExtendScript to a V8-based engine in After Effects 16.0. Evaluation "can be up to 5x faster than the Legacy ExtendScript engine." Projects saved in older versions default to Legacy. Target JavaScript-engine syntax (strict `if/else` with braces, `text.sourceText.value[i]` for character indexing, no snake_case `this_comp`/`to_world`).
2. **Camera control is mostly `cameraOption` + space transforms.** The camera is a Layer subclass accessed through `thisComp.activeCamera` or by name; DOF-related values live under `cameraOption`. Focus pulls, lookAt orientation, orbit rigs (null-parented), and zoom/FOV math are production-proven.
3. **2024–2026 feature additions are real but targeted.** Per-character text & paragraph styling (24.x; many `setX` methods note "added in 25.0"), variable-font scripting hooks, and `previousKey()`/`nextKey()` (26.0, JS-engine-only, Beta 26.0x40). The big v26 headline features (Substance 3D materials, AI Object Mask, parametric mesh displacement) are not expression features.
4. **MCP integration is mature.** Multiple open-source AE MCP servers expose an expression-setting tool mapping to `property.expression = expressionString`. Empty-string assignment removes the expression — matching Adobe's documented API.

---

# PART A — CAMERA EXPRESSIONS

## A.1 Camera object model
The Camera is a subclass of Layer. Access with `thisComp.activeCamera` (the camera rendering the current frame) or `thisComp.layer("Camera 1")`. Camera-specific attributes live under `cameraOption`:

- `cameraOption.zoom` — distance (px) from lens to the plane that fills the frame.
- `cameraOption.focusDistance` — focus plane distance, in px.
- `cameraOption.aperture` — aperture, in px (drives DOF blur, not exposure).
- `cameraOption.blurLevel` — DOF blur amount, %.
- `cameraOption.depthOfField` — 1 if DOF on, 0 if off.
- `cameraOption.irisShape`, `irisRotation`, `irisRoundness`, `irisAspectRatio`, `irisDiffractionFringe` — iris/bokeh shape controls.
- `cameraOption.highlightGain`, `highlightSaturation`, `highlightThreshold` — bokeh highlight controls (threshold range depends on bit depth: 0–100 in 8-bpc, 0–32768 in 16-bpc, 0–1.0 in 32-bpc).
- `pointOfInterest` and `active` (boolean — true if topmost enabled active camera at current time).

Camera layers do **not** have `source`, `effect`, `mask`, `width`, `height`, `anchorPoint`, `scale`, `opacity`, `audioLevels`, `timeRemap`, or 3D-material properties.

There is **no `focalLength` property** exposed to expressions — use `zoom` and convert (see A.6).

## A.2 Focus pulls / rack focus

**Lock focus to the point of interest** (Adobe canonical, on Focus Distance):
```js
length(position, pointOfInterest)
```

**Lock focus to another layer** (Dan Ebberts dot-product projection, on Focus Distance):
```js
target = thisComp.layer("Target");
V1 = target.toWorld(target.anchorPoint) - toWorld([0,0,0]);
V2 = toWorldVec([0,0,1]);
dot(V1, V2);
```

**Match focus distance to zoom** (everything at Z=0 in focus):
```js
cameraOption.zoom
```

**Reduce DOF blur as focus gets very close** (on Blur Level):
```js
f = cameraOption.focusDistance;
z = cameraOption.zoom;
linear(f, 0, z/2, 0, value);
```

## A.3 Auto-orientation & pointOfInterest

- Two-node camera = Auto-Orient "Orient Towards Point of Interest" (Layer ▸ Transform ▸ Auto-Orient, Ctrl/Cmd+Alt+O). One-node camera orients via its own Orientation/Rotation.
- Drive `pointOfInterest` to track a target:
```js
thisComp.layer("Target").toWorld([0,0,0])
```

**Make a 3D layer always face the active camera (full lookAt)** — on Orientation:
```js
C = thisComp.activeCamera;
lookAt(toWorld(anchorPoint), C.toWorld([0,0,0]))
```

**Y-axis-only camera facing** (upright billboards, Dan Ebberts) — on Orientation:
```js
camZ = normalize(thisComp.activeCamera.transform.position - thisComp.activeCamera.transform.pointOfInterest);
camX = normalize(cross(camZ, [0,1,0]));
[0, radiansToDegrees(Math.atan2(-camX[2], camX[0])), 0];
```

## A.4 Camera rigging (null-driven)

**Orbit rig (recommended, no expression):** create camera, parent to a 3D null at the point of interest (Layer ▸ Camera ▸ Create Orbit Null), animate the null's **Y Rotation** to orbit and the camera's **Z Position** to dolly. Nest two nulls for ascend/descend-while-orbiting.

**Expression-driven orbit** (camera Position around a controller null, radius/angle from sliders):
```js
ctrl = thisComp.layer("Controller");
r = ctrl.effect("Radius")("Slider");
ang = degreesToRadians(ctrl.transform.rotation);
c = ctrl.toWorld([0,0,0]);
[c[0] + r*Math.cos(ang), c[1], c[2] + r*Math.sin(ang)]
```

**Copy a moving camera's orientation onto a null** (Dan Ebberts):
```js
L = thisComp.layer("Null 1");
C = thisComp.layer("Camera 1");
u = C.fromWorldVec(L.toWorldVec([1,0,0]));
v = C.fromWorldVec(L.toWorldVec([0,1,0]));
w = C.fromWorldVec(L.toWorldVec([0,0,1]));
sinb = clamp(w[0],-1,1);
b = Math.asin(sinb);
cosb = Math.cos(b);
if (Math.abs(cosb) > .0005){
  c = -Math.atan2(v[0],u[0]);
  a = -Math.atan2(w[1],w[2]);
}else{
  a = Math.atan2(u[1],v[1]);
  c = 0;
}
[radiansToDegrees(a), radiansToDegrees(b), radiansToDegrees(c)]
```

## A.5 Distance to a layer & scale-preserving Z moves

**Distance from camera to this layer:**
```js
cam = thisComp.activeCamera;
length(sub(position, cam.position));
```

**Maintain on-screen size while changing Z** (Adobe reference, on Scale):
```js
cam = thisComp.activeCamera;
distance = length(sub(position, cam.position));
scale * distance / cam.zoom;
```

**Depth-based opacity fade** (Adobe — fade 500px→1500px):
```js
startFade = 500; endFade = 1500;
d = length(sub(position, thisComp.activeCamera.position));
linear(d, startFade, endFade, 100, 0)
```

## A.6 Zoom ↔ focal length ↔ angle of view

Identity (Walter Soyka): **`FilmBack / FocalLength = CompSize / Zoom`**. AE default film back 36 mm, focal length 50 mm; default horizontal FOV `2 × arctan(36 / (2 × 50)) = 39.6°`.

**Zoom (px) from focal length (mm):**
```js
filmBack = 36;
focalLength = 50;
thisComp.width * focalLength / filmBack;   // zoom in pixels
```

**Zoom from horizontal FOV (degrees):**
```js
FOV = 39.6;
thisComp.width / (2 * Math.tan(degreesToRadians(FOV/2)));
```

**FOV (degrees) from active camera zoom:**
```js
zoom = thisComp.activeCamera.cameraOption.zoom;
2 * radiansToDegrees(Math.atan2(thisComp.width, 2 * zoom));
```
Caveat: work in `zoom` directly unless exposing FOV/mm to a user. AE ignores aperture's effect on exposure.

## A.7 Camera shake / handheld

**Basic wiggle** (camera or null Position): `wiggle(2, 40)` — 2/sec, 40px.

**Octave control:** `wiggle(freq, amp, octaves=1, amp_mult=0.5)` → `wiggle(1, 10, 3, 0.2)`

**Layered handheld rig:**
- Position: `wiggle(2, 15)`
- Orientation/Rotation: `wiggle(1.5, 1.5)`
- Point of Interest: `wiggle(1, 8)`
- Focus Distance (breathing): `wiggle(1.5, 8)`
- Ramp fatigue: `wiggle(2, 20 + time*2)`

For all layers, add the **Transform** effect on an adjustment layer and wiggle its Position.

---

# PART B — FULL EXPRESSION LANGUAGE

## B.1 Engine differences (legacy vs JavaScript)
| Topic | Legacy ExtendScript | JavaScript engine |
|---|---|---|
| Standard | ECMAScript 3 (1999) | modern ECMAScript (V8 on Windows) |
| Speed | baseline | up to 5× faster on render |
| Source Text | needs trailing `.value` | shows value by default |
| `if/else` | loose | **strict** — needs braces/line breaks |
| Char indexing | `text.sourceText[i]` | `text.sourceText.value[i]` |
| snake_case (`this_comp`, `to_world`) | worked (deprecated) | **not supported** |
| `this(arg)` shorthand | worked | not supported |

Set via File ▸ Project Settings ▸ Expressions. `.jsx` libraries and `eval()` are **not** pre-processed — write JS-clean there.

## B.2 Global objects & methods
`time`, `thisComp`, `thisLayer`, `thisProperty`, `comp("name")`, `footage("name")`, `thisProject`. Comp attrs: `width`, `height`, `duration`, `frameDuration`, `pixelAspect`, `numLayers`, `layer(n)`, `marker`.

## B.3 Property attributes & methods
`value`; `valueAtTime(t)`; `velocity`/`velocityAtTime(t)`; `speed`/`speedAtTime(t)`; `numKeys`; `key(n).value`/`.time`/`.index`; `nearestKey(t)`; `propertyGroup(levels)`; `propertyIndex`; `name`. **New in AE 26.0:** `previousKey(t)` and `nextKey(t)` (JS-engine-only, Beta 26.0x40).

Fastest manual speed (valueAtTime beats velocityAtTime/toWorld):
```js
p1 = thisLayer.transform.position.valueAtTime(time);
p0 = thisLayer.transform.position.valueAtTime(time - 0.01);
(p1 - p0) * 100;
```

## B.4 Interpolation (AE extensions, not JS)
`linear(t, tMin, tMax, value1, value2)`, `ease(...)`, `easeIn(...)`, `easeOut(...)`, `clamp(value, limit1, limit2)`.
```js
easeOut(effect("Amount")("Slider"), 0, 100, 0, 100)
```

## B.5 Vector math (global, no `Math.` prefix)
`add`, `sub`, `mul(vec,k)`, `div(vec,k)`, `normalize`, `length(vec)`/`length(p1,p2)`, `dot`, `cross`, `lookAt(fromPoint, atPoint)`. Dimension-lenient: `add([10,20],[1,2,3]) → [11,22,3]`.

## B.6 Random & noise
`random()`, `random(max)`, `random(min,max)`, `gaussRandom(...)`, `noise(...)` (Perlin −1..1), `wiggle(freq, amp, octaves, amp_mult, t)`, `temporalWiggle(...)`, `seedRandom(seed, timeless)`, `posterizeTime(fps)`.
```js
seedRandom(index, true);
random(80, 120)
```

## B.7 Time conversion
`timeToFrames`, `framesToTime`, `timeToTimecode`, `timeToNTSCTimecode`, `timeToCurrentFormat`.
```js
timeToTimecode(outPoint - inPoint, 30, true)
```

## B.8 Layer space transforms
- `toComp`/`fromComp` — layer ↔ composition (camera-view) space.
- `toWorld`/`fromWorld` — layer ↔ view-independent world (3D) space.
- `toCompVec`/`fromCompVec`/`toWorldVec`/`fromWorldVec` — **vector** versions (direction only).
- `fromCompToSurface(point)` — projects a comp-space point onto the layer surface (z=0).

`toComp([0,0,0])` = where a layer's anchor lands on screen (pin 2D effects to 3D nulls). `toWorldVec([1,0,0])` = world direction (auto-orient/camera-facing backbone).
```js
// 2D world rotation of a child/auto-oriented layer (Dan Ebberts)
L = thisComp.layer("leader");
u = L.toWorldVec([1,0]);
radiansToDegrees(Math.atan2(u[1], u[0]))
```

## B.9 Layer general attributes/methods
`marker` (+ `marker.nearestKey`, `marker.key(n)`, `marker.numKeys`), `sourceRectAtTime(t, includeExtents)` (`{top,left,width,height}`), `sampleImage(point, radius, postEffect, t)` (`[r,g,b,a]`), `effect("name")(param)`, `mask("name")`, `text.sourceText`, `name`, `index`, `inPoint`/`outPoint`, `hasParent`, `parent`.

## B.10 Color conversion
`rgbToHsl`, `hslToRgb`, `hexToRgb("FFCC00")` — normalized `[r,g,b,a]` 0–1 arrays.

## B.11 JavaScript Math
`Math.sin/cos/tan`, `Math.atan2(y,x)`, `Math.PI`, `Math.floor/ceil/round`, `Math.abs`, `Math.exp`, `Math.min/max`, `Math.sqrt`, `Math.pow`. Bridge trig with `degreesToRadians()`/`radiansToDegrees()`.

## B.12 New-ish features (2024–2026)
- **Per-character text & paragraph styling** (24.x): `text.sourceText.getStyleAt(charIndex, time)`, `.style`, setter chains `.setFontSize()`, `.setFont()`, `.setFillColor()`, `.setTracking()`, `.setText()`. Many setters "added in 25.0". `.style` returns the first char's style — use `getStyleAt(i,t)` for multi-style.
```js
src = thisComp.layer("MAIN TEXT").text.sourceText;
src.getStyleAt(0,0).setText(src);
```
```js
text.sourceText.createStyle().setFontSize(300).setFont("Impact").setText("Hello world!");
```
- **Variable-font hooks** (Beta 24.0x25) — no per-char axis animation; 300–500 ms overhead reported.
- **`previousKey()`/`nextKey()`** — AE 26.0, JS engine only, Beta 26.0x40.
- Ecosystem: AE 2026 headlines are 3D/AI, not expressions. Editors: **expressCode**, **Expression Kit** target the reusable-library workflow.

## B.13 Practical recipes

**Inertial bounce / overshoot (Dan Ebberts)** — needs incoming velocity (no ease-in on last key):
```js
amp = .1; freq = 2.0; decay = 2.0;
n = 0;
if (numKeys > 0){
  n = nearestKey(time).index;
  if (key(n).time > time){ n--; }
}
if (n == 0){ t = 0; } else { t = time - key(n).time; }
if (n > 0 && t < 1){
  v = velocityAtTime(key(n).time - thisComp.frameDuration/10);
  value + v*amp*Math.sin(freq*t*2*Math.PI)/Math.exp(decay*t);
} else { value; }
```

**Loop variants:**
```js
loopOut();              // = loopOut("cycle")
loopOut("pingpong");
loopOut("offset");      // accumulates the delta each cycle
loopOut("continue");    // extrapolates last key velocity
loopOut("cycle", 2);    // loop only last N segments
loopIn("cycle"); loopIn("pingpong"); loopIn("offset");
loopOutDuration("cycle", 3);  // by seconds, not keyframes
```

**Inertial follow / delay (leader-follower):**
```js
delay = 5; // frames
d = delay*thisComp.frameDuration*(index - 1);
thisComp.layer(1).position.valueAtTime(time - d)
```

**Staggered delay with absolute referencing** (immune to reordering):
```js
startLayer = thisComp.layer("startLayer");
myIndex = index - startLayer.index;
delay = 5;
d = delay*thisComp.frameDuration*(myIndex - 1);
thisComp.layer(1).position.valueAtTime(time - d)
```

**Responsive text box** (shape size to fit text + padding):
```js
s = thisComp.layer("My Text Layer");
pad = [40, 30];
[s.sourceRectAtTime().width + pad[0], s.sourceRectAtTime().height + pad[1]]
```
**Box position centered on text** (rectangle path Position):
```js
s = thisComp.layer("My Text Layer");
r = s.sourceRectAtTime();
[r.left + r.width/2, r.top + r.height/2]
```
Nested/parented-robust (Dan Ebberts):
```js
L = thisComp.layer("text");
r = L.sourceRectAtTime(time, false);
fromComp(L.toComp([r.left + r.width, r.top + r.height]))
```

**Countdown / timer (Source Text):**
```js
rate = 1; clockStart = 20;
function pad(n){ return (n < 10 ? "0" : "") + n; }
t = Math.max(clockStart - rate*(time - inPoint), 0);
mins = Math.floor(t/60);
secs = Math.floor(t % 60);
pad(mins) + ":" + pad(secs)
```

**Begin/end an effect at a marker (Adobe):**
```js
n = 0; t = 0;
if (marker.numKeys > 0){
  n = marker.nearestKey(time).index;
  if (marker.key(n).time > time) n--;
}
if (n > 0) t = time - marker.key(n).time;
amp = 15; freq = 5; decay = 3.0;
angle = freq * 2 * Math.PI * t;
scaleFact = (100 + amp * Math.sin(angle) / Math.exp(decay * t)) / 100;
[value[0] * scaleFact, value[1] / scaleFact];
```

## B.14 Error handling, performance, enable/disable
- **`try/catch`** for resilient expressions:
```js
try {
  nameText.split(" ")[0].charAt(0) + nameText.split(" ")[1].charAt(0);
} catch (err) {
  nameText.split(" ")[0].charAt(0);
}
```
- **Errors don't auto-disable** — AE shows a warning banner and keeps evaluating until fixed/disabled.
- **Performance:** `posterizeTime(0);` at top freezes value at comp time 0 (since AE 2020) — community test 14:51 → 9:16 render. Use `posterizeTime(fps)` to throttle. Avoid loops/RegEx; skip expensive branches with conditionals; prefer `valueAtTime` over `toWorld` chains.
- **Disable/enable:** per-property switch, or Edit ▸ Preferences ▸ Scripting & Expressions. Comment with `//`.

---

# PART C — ORGANIZING A LIBRARY FOR MCP / FOLDER USE

## C.1 Storage formats
- **`.ffx` animation/behavior presets** — Animation ▸ Save Animation Preset. Behavior presets use expressions instead of keyframes. Stored in `Documents/Adobe/After Effects <ver>/User Presets` or `…/Support Files/Presets`; subfolders become Effects & Presets categories. Carry expressions, effects, expression controls, keyframes. Gotcha: expression-controlled presets need the linked Expression Control effects selected when saving.
- **`.jsx` expression libraries** — external function libraries; **not** pre-processed, so write JS-engine-clean (slightly faster).
- **Scripts (`.jsx`/`.jsxbin`)** in the Scripts folder — the MCP application path.
- **Pseudo-effect `.ffx`** (match name `Pseudo/...`) for shareable custom control panels.

## C.2 Naming / categorization
- Descriptive names: `Camera_FocusLock_PointOfInterest`, `Loop_Offset`, `Text_ResponsiveBox`.
- Folders mirror categories: `Camera/`, `Loops/`, `Text/`, `Transforms/`, `Random/`, `Time/`, `Color/`, `SpaceTransforms/`.
- AE ignores folders named `(like this)` — useful for staging.
- For an MCP: one record per snippet `{name, category, code, targetPropertyType, requiresCompanions, engine:"javascript", minVersion}`. Comment companion-layer requirements inline.

## C.3 Existing AE MCP servers & expression handling
- **Dakkshin/after-effects-mcp** (MIT, ~311★) — tool **`setLayerExpression`** with `compIndex` (1-based), `layerIndex` (1-based), `propertyName` ("Position"/"Scale"/"Rotation"/"Opacity"), `expressionString` (`""` removes). Node/TS server writes `ae_command.json`; `mcp-bridge-auto.jsx` polls and executes. *(This is the server set up in this repo.)*
- **ishu86/after-effects-mcp** ("70+ tools") — `set_expression` (not `add_expression`), `get_expression`, `remove_expression`, `enable_expression`, `add_expression_control`, **`apply_expression_template`** (wiggle, wiggleSmooth/FadeIn/FadeOut, loopCycle/Pingpong/Offset/Continue, time, clock, countdown, frameNumber, matchPosition, offsetPosition, inverseRotation, followPath, bounce, inertia, overshoot, springy), `link_properties`. CEP extension + `jsx/host.jsx`, file IPC every 100 ms.
- **TheLlamainator/after-effects-mcp** — Dakkshin fork + effects/preset/audio tools.
- **Aodaruma/after-effects-mcp-rs** — Rust port; adds compId/layerId targeting.
- **p10q/ae-mcp**, **jovaughn96/aftereffects-mcp**, **tigerm/adobe-after-effects-mcp** — variants; some allow arbitrary IIFE-wrapped JSX.

All require Edit ▸ Preferences ▸ Scripting & Expressions ▸ **Allow Scripts to Write Files and Access Network**.

## C.4 How an MCP applies an expression (ExtendScript API)
- **`Property.expression`** — writeable only when `canSetExpression` is true; the string is evaluated. Valid → `expressionEnabled` true; invalid → error + `expressionEnabled` false; `""` disables without error.
- **`Property.expressionEnabled`** — true = uses expression, false = keyframes/static value. R/W.
- **`Property.canSetExpression`** — true = type whose expression a script can set. Read-only.
- **`Property.expressionError`** — last evaluation error, or `""`. Read-only.

Canonical apply pattern:
```jsx
var comp = app.project.item(compIndex);          // CompItem
var layer = comp.layer(layerIndex);
var prop = layer.property("Transform").property(propertyName); // "Position"
if (prop.canSetExpression) {
    prop.expression = expressionString;          // "" removes it
    if (prop.expressionError !== "") {
        // surface prop.expressionError back to the caller
    }
}
```
Wrap in `app.beginUndoGroup`/`endUndoGroup`. Prefer `compId`/`layerId` over indices to avoid drift.

---

# Recommendations
1. **Build the snippet store now** — folder hierarchy above, one record per expression seeded with these recipes, all JS-engine-clean. Flag loop/RegEx snippets; prefer `valueAtTime`/`posterizeTime` alternatives.
2. **Wire to an MCP** — adopt/fork Dakkshin (`setLayerExpression`) or ishu86 (`apply_expression_template`). Bridge sets `property.expression = code` after `canSetExpression`, reads back `expressionError`. Enable file/network access; use undo groups; prefer ID targeting.
3. **Companion-aware application** — for snippets needing controller nulls + sliders (orbit, timer, stagger, shake-with-controls), create those first, then set the expression; encode in `requiresCompanions`. Offer `.ffx` behavior presets as export.
4. **Version gating** — tag `previousKey()`/`nextKey()` as min AE 26.0, per-char style setters as min 25.0; detect `app.version` and substitute fallbacks. Re-test each release.

# Caveats
- **No `focalLength` property** — convert from `zoom` (A.6); film back assumed 36 mm, focal length 50 mm.
- **lookAt quirks** — camera-facing/Y-only break near straight-down angles and through complex parent chains; test per rig.
- **Inertial bounce needs incoming velocity** — ease-in on the final key → zero motion.
- **Engine mismatch is the #1 failure mode** — pre-2020 projects open Legacy; set/verify the JS engine before applying.
- **Variable-font expressions are heavy** (300–500 ms) and lack per-char axis animation.
- **`property.expression = code` is the near-certain implementation** of the servers' expression tools (empty-string-removes matches Adobe's API), but verify the literal bridge source in the repo you adopt.
- **`.ffx` gotchas** — position/scale keyframes can overwrite transforms; renamed effects break expression links; 4K-tuned values differ at 1080p.
- **AE 2026 (v26) headline features are not expression features** — expression-relevant additions are per-char text (25.0) and `previousKey`/`nextKey` (26.0).
