# Capability: Smooth Camera Movement in After Effects

A reusable playbook for Claude when driving After Effects through the
**AfterEffectsMCP** server. Distilled from the *Smooth Camera Movement in After
Effects* tutorial and mapped to the available MCP tools.

> Drop this file into your Claude Desktop **Project knowledge** (or keep it in
> `~/after-effects-mcp/`) so Claude can reference it when you ask for smooth
> camera moves / UI animation.

---

## Core principles (the "why")

1. **Plan before animating** — script → storyboard → style frames. Know the
   scene order and what each camera move should reveal.
2. **Null objects are the camera rig.** Animate nulls, parent real layers to
   them. Moving a higher-level null moves all its descendants.
3. **Always enable 3D + Motion Blur** on any null that drives visible layers,
   and on the layers themselves.
4. **Easing makes it smooth.** Raw linear keyframes look robotic. Apply Easy
   Ease, then shape the velocity curve in the Graph Editor.
5. **Timeline hygiene** — trim unused layer portions, use `[` to set layer start
   times, keep the hierarchy named and organized.

---

## MCP tool map

| Tutorial action | AfterEffectsMCP tool |
|---|---|
| Create comp (1920×1080 @ 30fps) | `create-composition` |
| Add null rig | `createNullObject` |
| Add camera layer | `createCamera` |
| Enable 3D / blend mode / opacity / enabled | `setLayerProperties` (`threeDLayer: true`, etc.) |
| Apply same props to many layers | `batchSetLayerProperties` |
| Keyframe Position / Scale / Rotation / Opacity | `setLayerKeyframe` |
| Procedural motion (wiggle, inertia) | `setLayerExpression` |
| Duplicate / delete layers | `duplicateLayer` / `deleteLayer` |
| Inspect a layer (3D status, position) | `getLayerInfo` |
| **Parenting (pick whip), Easy Ease, Graph-Editor curves, motion blur toggle** | `run-script` (raw ExtendScript — see notes) |
| Read back results of any command | `get-results` |

> ⚠️ **Gaps to cover with `run-script`:** the dedicated tools don't expose
> *parenting*, *keyframe interpolation/Easy Ease*, *velocity (graph) curves*, or
> the *comp motion-blur switch*. Do those via `run-script` with ExtendScript
> (snippets below). Every command is picked up by the open
> `mcp-bridge-auto.jsx` panel, so it must be open with **Auto-run** on.

---

## The repeatable workflow

### 1. Composition & assets
- `create-composition` → name `UI animation`, 1920×1080, 30 fps, duration as needed.
- Import assets as **Composition / Retain layer sizes / Editable layer styles**.
- Group source layers into an `assets` folder; copy background + content comps
  into the main comp.

### 2. Build the null rig (camera hierarchy)
For each scene group:
1. `createNullObject` → rename meaningfully (`notes`, `spotlight`, `video players`, `XUI`).
2. `setLayerProperties` on the null and its children → `threeDLayer: true`.
3. Enable motion blur + **parent** children to the null via `run-script`.
4. Chain nulls for global moves (e.g. parent `null 3` + `null 5` → a top
   controller null that acts as the virtual camera).

**Suggested hierarchy pattern (from the tutorial):**
```
notes      → note-app layers          (collective slide in/out)
null 2     → background + notes        (zoom into first text)
null 3     → spotlight layers + null 2 (global pan & zoom)
null 5     → combined spotlight + text motion
null 6/7   → exit transition
null 9     → video player layers       (spin start)
null 11    → XUI layers                (spin continuation)
null 12    → final camera drift        (end-scene pan)
```

### 3. Animate the camera move
1. `setLayerKeyframe` on the controller null's **Position** (and **Orientation**
   for spins) at start/end times.
2. Apply **Easy Ease** to those keyframes (`run-script`).
3. Shape the velocity curve in the Graph Editor (`run-script`):
   - **Zoom/pan:** ease in *and* out (slow-fast-slow).
   - **Spin out:** slow-start, fast-end (drag left handle in, right flat).
   - **Spin handoff in:** fast-start, slow-end (reverse) for a seamless cut.
4. Stagger entrances by offsetting keyframes 2–3 frames per layer for rhythm.

### 4. Scene transitions
- **Spotlight:** parent layers to a `spotlight` null, push Z forward, animate
  text/items/suggestions with Position+Scale+Opacity + Easy Ease.
- **Video player:** parallax by separating layers on Z; zoom out via the null's
  Position to reveal surrounding players.
- **Spin → XUI:** keyframe Position+Orientation on `null 9` (slow→fast), hand off
  to `null 11` with the reversed curve, fade UI in with Opacity near the end.
- **Final drift:** `null 12` glides Position across the final text, Easy Eased,
  ending on the last word centered.

### 5. Verify
- Use `get-results` after each command to confirm success.
- `getLayerInfo` to check 3D state / positions before keyframing.

---

## ExtendScript snippets for `run-script` (the gaps)

**Parent layer B to null A (pick whip):**
```javascript
var comp = app.project.activeItem;
var parent = comp.layer("notes");
var child  = comp.layer("Note Title");
child.parent = parent;
```

**Apply Easy Ease to all keyframes of a property:**
```javascript
var comp = app.project.activeItem;
var prop = comp.layer("null 3").property("Transform").property("Position");
for (var i = 1; i <= prop.numKeys; i++) {
  prop.setInterpolationTypeAtKey(i, KeyframeInterpolationType.BEZIER, KeyframeInterpolationType.BEZIER);
  var ease = new KeyframeEase(0, 33);            // speed 0, influence 33%
  prop.setTemporalEaseAtKey(i, [ease], [ease]);
}
```

**Slow-start / fast-end curve (spin out):** higher influence on the *out* of the
first key, lower on the *in* of the last:
```javascript
var easeLow  = new KeyframeEase(0, 10);
var easeHigh = new KeyframeEase(0, 90);
prop.setTemporalEaseAtKey(1, [easeLow],  [easeHigh]); // first key: ease out hard
prop.setTemporalEaseAtKey(prop.numKeys, [easeHigh], [easeLow]); // last key: settle
```

**Enable comp + layer motion blur:**
```javascript
var comp = app.project.activeItem;
comp.motionBlur = true;                 // comp-level switch
comp.layer("null 3").motionBlur = true; // per-layer switch
```

---

## Quick-prompt examples (what to tell Claude Desktop)

- "Create the `UI animation` comp (1920×1080, 30fps), add a 3D null named
  `camera`, and parent all current layers to it."
- "Keyframe `camera` Position to zoom from the full board into the first note
  over 1.5s, then Easy Ease it with a slow-fast-slow curve."
- "Set up the spin transition on `null 9`: rotate 180° on Orientation over 1s,
  slow-start fast-end, then fade the XUI layers in over the last 10 frames."
