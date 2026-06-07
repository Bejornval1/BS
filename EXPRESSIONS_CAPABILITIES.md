# Capability: After Effects Expressions Library

Reusable expression recipes for Claude when driving After Effects through the
**AfterEffectsMCP** server. Recovered from the *Expression Examples.aep* project
and cleaned up.

> **How to apply with the MCP:** use the `setLayerExpression` tool to attach any
> of these to a property (Position, Scale, Rotation, Opacity, Source Text, a
> shape Path, etc.). For things `setLayerExpression` can't target directly, drop
> the same code via `run-script` using `property.expression = "..."`.
> Many of these reference **named layers** or **effect controls** (Sliders,
> Dropdown) — create those first (`createNullObject`, `setLayerProperties`, or
> `run-script` to add expression controls) so the names resolve.

---

## 1. Animation loops

**Loop forever (cycle):** apply to a property that has ≥2 keyframes.
```javascript
loopOut("cycle");
```

**Ping-pong (back and forth):**
```javascript
loopOut("pingpong");
```

**Combine loopIn + loopOut** — loop before the first and after the last keyframe:
```javascript
// Set loop mode as a String
var loopMode = "cycle";

// Combine looped values with the original value
loopIn( loopMode ) + loopOut( loopMode ) - value;
```

---

## 2. Overshoot / bounce on keyframes

Adds springy overshoot *after* each keyframe. Link `amp`/`freq`/`decay` to Slider
controls to tune live. Great on Scale or Position. (Apply to the property that
already has the keyframes.)
```javascript
// Set up values to control overshoot.
// Link these to Slider expression controls to quickly preview different settings.
var amp = 40;
var freq = 30;
var decay = 50;

// Find the most recent keyframe
var nK = nearestKey(time);
var n = ( nK.time <= time ) ? nK.index : --nK.index;
var t = ( n === 0 ) ? 0 : time - key( n ).time;

// If the current time is later than a keyframe, calculate overshoot. If not, use original value.
if ( n > 0 && t < 1 ) {
	var v = velocityAtTime( key( n ).time - thisComp.frameDuration / 10 );
	value + v * amp * .001 * Math.sin( freq * .1 * t * 2 * Math.PI ) / Math.exp( decay * .1 * t );
} else {
	value;
}
```

---

## 3. Wiggle

**Wiggle linked to a Slider** (Position/Scale/anything): create a Slider control
named "Wiggle Amount" on the layer first.
```javascript
// Use the pickwhip to create the "effect(...)" link to the Slider
var wiggleAmount = effect("Wiggle Amount")("Slider");

// Wiggles 4 times per second by the amount set by the Slider
wiggle( 4, wiggleAmount );
```

---

## 4. Remapping with `linear()`

**Map a Slider (0–100) to an X position (0–490), keep Y:**
```javascript
var targetSlider = thisComp.layer("Square").effect("Wiggle Amount")(1);
var x = linear( targetSlider, 0, 100, 0, 490 );
[ x, value[1] ];
```

**Map a shape's path rotation (0–240) to a full 0–360 sweep:**
```javascript
var targetProp = thisComp.layer("Triangle").content("Polystar 1").content("Polystar Path 1").rotation;
linear( targetProp, 0, 240, 0, 360 );
```

---

## 5. Follow / track another layer (comp-space conversion)

**Stick to another layer's anchor point in composition space** (works across
different parenting/3D). Swap `"Triangle"` for `"Ball"`, `"Square"`, etc.
```javascript
var targetLayer = thisComp.layer("Triangle");
targetLayer.toComp( targetLayer.anchorPoint );
```

**Follow a layer but stay independently movable** (adds your own Position on top):
```javascript
// Define the parented layer
var targetLayer = thisComp.layer("Child");

// Find the parented layer's Anchor Point in the Composition
var actualPosition = targetLayer.toComp( targetLayer.anchorPoint );

// Add the parented layer's location to this layer's Position
// so that this layer can still be repositioned
actualPosition + value;
```

**Follow via an effect-control layer reference (Set Matte):**
```javascript
var targetLayer = effect("Set Matte")("Take Matte From Layer");
targetLayer.toComp( targetLayer.anchorPoint );
```

---

## 6. Delayed follow (echo / trailing motion)

Lag behind a parent layer by N frames — chain several layers for a trailing
"snake". Apply to **Position**.
```javascript
// Set a delay amount in frames
var delay = 5;

// Shift the layer's Position in time based on delay
parent.fromComp( toComp( anchorPoint, time - framesToTime( delay ) ) );
```
Variant with a fixed time offset:
```javascript
var delay = framesToTime( 10 );   // try 10, 15, ...
parent.fromComp( toComp( anchorPoint, time - delay ) );
```

---

## 7. Auto-size to another layer (`sourceRectAtTime`)

Make a shape/box match its parent layer's bounding box. Apply to **Scale** or a
shape **Size** property.
```javascript
var sRect = parent.sourceRectAtTime();
[ sRect.width, sRect.height ];
```

---

## 8. Connect two layers with a line (shape Path)

Apply to a shape layer's **Path** to draw a live line between two layers'
anchors. Rename the layers to `"Parent"` and `"Child"` (or edit names).
```javascript
var startLayer = thisComp.layer("Parent");
var endLayer = thisComp.layer("Child");

createPath(
	[
		fromComp( startLayer.toComp( startLayer.anchorPoint ) ),
		fromComp( endLayer.toComp( endLayer.anchorPoint ) ),
	],
	[], [], false
);
```

---

## 9. Dropdown-driven text

Switch a text layer's **Source Text** from a Dropdown Menu Control:
```javascript
// Create link to Dropdown with Pickwhip and add ".value" to the end
var dropdownMenu = effect("Dropdown Menu Control")("Menu").value;

// Create an array with all text options
var itemArray = [ "First Item", "Second Choice", "Third Option" ];

// Use dropdownMenu to select an item from itemArray,
// subtracting 1 because arrays indexes count up from zero
itemArray[ dropdownMenu - 1 ];
```

---

## Applying an expression via `run-script` (when `setLayerExpression` can't reach it)

```javascript
var comp = app.project.activeItem;
var prop = comp.layer("Square").property("Transform").property("Position");
prop.expression = 'wiggle(4, 50)';   // set
// prop.expression = '';             // remove
```

> Tip: to add the expression controls these recipes reference (Slider, Dropdown),
> apply them as effects first, e.g.
> `comp.layer("Square").Effects.addProperty("ADBE Slider Control");`
> then rename, then set the expression that links to it.
