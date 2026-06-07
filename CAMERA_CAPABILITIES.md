# Capability: After Effects Camera (expressions & control)

Reference + recipes for working with **Camera layers** when driving After Effects
through the **AfterEffectsMCP** server. Create cameras with the `createCamera`
tool; read camera settings in expressions via `thisLayer.cameraOption`; attach
expressions with `setLayerExpression` (or `run-script` for properties the named
tool can't reach).

> A Camera is a Layer subclass: it has Position, Orientation, Rotation, Point of
> Interest — but **no** `source`, `mask`, `opacity`, `scale`, `anchorPoint`,
> `width/height`, or material options. It's a viewpoint, not pixels.

---

## Readable camera attributes (`thisLayer.cameraOption`)

| Property | Returns |
|---|---|
| `active` | `true` if this is the comp's active camera now (video switch on, within in/out, topmost) |
| `zoom` | focal length in **pixels** — drives perspective (wide ↔ telephoto) |
| `pointOfInterest` | 3D world-space point the camera looks at — `[x,y,z]` |
| `depthOfField` | `1`/`0` — is Depth of Field enabled |
| `focusDistance` | distance (px) to the focus plane |
| `aperture` | aperture in px — larger = more DOF blur |
| `blurLevel` | DOF blur strength (%) |
| `irisShape` | bokeh shape, 1–10 (value `2` is a divider) |
| `irisRotation` | iris rotation (degrees) |
| `irisRoundness` | iris roundness (%) |
| `irisAspectRatio` | iris aspect ratio, 1–100 |
| `irisDiffractionFringe` | diffraction fringe, 1–100 |
| `highlightGain` | highlight bloom gain, 1–100 |
| `highlightSaturation` | highlight bloom saturation, 1–100 |
| `highlightThreshold` | bloom threshold (8-bit 0–100, 16-bit 0–32768, 32-bit 0–1.0) |

> The iris / highlight / aperture / blur values only matter when **Depth of
> Field** is on — they shape the cinematic background blur (bokeh).

Useful non-cameraOption reads: `thisComp.activeCamera` (the current camera),
`cameraLayer.position`, `cameraLayer.transform.orientation`.

---

## Recipes

### 1. Constant on-screen size (cancel perspective scaling)
Apply to a **layer's Scale**. Keeps the layer the same apparent size in frame even
as it moves in Z or the camera zooms/dollies.
```javascript
cam = thisComp.activeCamera;
distance = length( sub( position, cam.position ) );
scale * distance / cam.zoom;
```

### 2. Auto-focus on a target layer (focus pull)
Apply to the camera's **Focus Distance** so DOF always stays sharp on a chosen
layer. (Enable Depth of Field on the camera first.)
```javascript
target = thisComp.layer("Hero");
length( sub( position, target.toWorld( target.anchorPoint ) ) );
```

### 3. Focus on the Point of Interest
If you animate the camera's Point of Interest, lock focus to it:
```javascript
length( sub( position, pointOfInterest ) );
```

### 4. Layer fades with distance (depth haze)
Apply to a **layer's Opacity** — fade out as it moves far from the camera.
Tune `near`/`far` (in px).
```javascript
cam = thisComp.activeCamera;
d = length( sub( position, cam.position ) );
var near = 500, far = 3000;
linear( d, near, far, 100, 0 );   // 100% up close, 0% far away
```

### 5. Only act when this camera is active
Guard an expression so it only drives values while its camera is live:
```javascript
active ? value : value;   // replace branches as needed, e.g. zoom shifts
```

### 6. Handheld camera shake (wiggle a camera null)
Best practice: parent the camera to a **null** and wiggle the null so you keep
clean keyframes on the camera itself. On the null's **Position**:
```javascript
wiggle( 2, 15 );    // 2x/sec, 15px — subtle handheld
```
On the null's **Orientation** for rotational sway:
```javascript
wiggle( 1, 2 );
```

### 7. Auto-orient a layer to always face the camera (billboard)
Apply to a 3D layer's **Orientation** so it faces the active camera:
```javascript
lookAt( position, thisComp.activeCamera.position );
```
> Or just use Layer ▸ Transform ▸ Auto-Orient ▸ "Orient Towards Camera".

---

## Building a camera move via the MCP (typical sequence)

1. `createCamera` — add the camera (set initial zoom/position).
2. `createNullObject` → rename `camera control`; **parent the camera to it**
   (`run-script`: `comp.layer("Camera 1").parent = comp.layer("camera control")`).
3. `setLayerKeyframe` on the null's **Position** (and **Orientation**) for the move.
4. Easy Ease + Graph Editor curves via `run-script` (see `CAPABILITIES.md`).
5. Optional: `setLayerExpression` to add recipe #1 (constant size), #2 (focus
   pull), or #6 (shake) above.

### Enable Depth of Field via `run-script`
```javascript
var comp = app.project.activeItem;
var cam  = comp.layer("Camera 1");
cam.cameraOption.depthOfField.setValue(1);
cam.cameraOption.aperture.setValue(50);     // bigger = more blur
// focusDistance can be keyframed or driven by recipe #2/#3
```

---

## Apply an expression with `run-script` (when the tool can't target it)
```javascript
var comp = app.project.activeItem;
var prop = comp.layer("Hero").property("Transform").property("Scale");
prop.expression = 'cam = thisComp.activeCamera;\\n' +
                  'distance = length( sub( position, cam.position ) );\\n' +
                  'scale * distance / cam.zoom;';
// prop.expression = '';  // remove
```
