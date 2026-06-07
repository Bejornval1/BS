// ============================================================================
// LoadDash — Scene 2 / Step 2 "Choose your items"  ELEMENT BUILD
// ----------------------------------------------------------------------------
// The 6 item layers are ALREADY in the timeline. This script:
//   - finds each item layer by name and applies the ring -> orbit(x2) -> land
//     Position expression (plus optional self-spin + settle-bounce)
//   - creates the "STEP 2" title + "pick your items" prompt (animate in),
//     unless layers with those names already exist
//
// It NEVER creates duplicate items, never renames your item layers, and never
// deletes them. Re-running just refreshes the expressions (safe to iterate).
// Camera 2, Card 2, and the navy background are left untouched.
//
// HOW TO RUN
//   1. Make your Scene 2 comp active.
//   2. File > Scripts > Run Script File...  (or Claude Desktop: "run via run-script")
//   3. Read the summary it prints (matched / missing / ambiguous items).
// ============================================================================

(function () {

  // ============================ CONFIG ====================================
  var COMP_NAME         = "";     // "" = active comp, or e.g. "Scene 2"
  var ADD_SELF_SPIN     = true;   // Rotation: tumble twice during the orbit
  var ADD_SETTLE_BOUNCE = true;   // Scale: small overshoot when it lands
  var STAGGER           = false;  // arrive ~2 frames apart (adds i*0.08 to tIn/tForm)
  var BUILD_TEXT        = true;   // create the title + prompt if missing

  // ring + timing (from the spec)
  var Cx = 3260, Cy = 540, R = 320, N = 6;
  var tIn = 28.8, tForm = 29.4, tOrbitEnd = 31.4, tLand = 32.4;

  // 6 items: name (matched against timeline layer names), i, fx/fy (2x3 grid)
  var ITEMS = [
    { name:"yard-debris",  i:5, fx:2950.87, fy:525, label:"top-left"     },
    { name:"other",        i:4, fx:3256.87, fy:537, label:"top-center"   },
    { name:"bagged-trash", i:0, fx:3529.87, fy:531, label:"top-right"    },
    { name:"donation",     i:2, fx:2992.87, fy:888, label:"bottom-left"  },
    { name:"furniture",    i:3, fx:3268.87, fy:903, label:"bottom-center"},
    { name:"cardboard",    i:1, fx:3556.87, fy:894, label:"bottom-right" }
  ];

  // text
  var TITLE_TEXT  = "STEP 2";
  var PROMPT_TEXT = "pick your items";
  var TITLE_POS   = [2900, 200];   // tweak to taste (top/right of the card)
  var PROMPT_POS  = [2900, 330];
  var TEXT_IN_START = 27.5, TEXT_IN_END = 28.2;

  var TAG = "S2_";   // only used for the text layers this script makes
  // ========================================================================


  // ----------------------------- helpers ----------------------------------
  function findComp(name){
    if (name){
      for (var i=1;i<=app.project.numItems;i++){
        var it=app.project.item(i);
        if (it instanceof CompItem && it.name===name) return it;
      }
      return null;
    }
    var a=app.project.activeItem;
    return (a && (a instanceof CompItem)) ? a : null;
  }

  // match a timeline layer to an item name; returns layer, null, or "AMBIGUOUS"
  function matchLayer(comp, base){
    var b = base.toLowerCase();
    var exts = ["", ".png", ".psd", ".ai", ".jpg", ".jpeg", ".tif"];
    // 1) exact name (with/without a common extension), case-insensitive
    for (var e=0;e<exts.length;e++){
      var target = b + exts[e];
      for (var i=1;i<=comp.numLayers;i++){
        if (comp.layer(i).name.toLowerCase() === target) return comp.layer(i);
      }
    }
    // 2) "contains" — only if exactly one layer contains the base name
    var hits=[];
    for (var j=1;j<=comp.numLayers;j++){
      if (comp.layer(j).name.toLowerCase().indexOf(b) !== -1) hits.push(comp.layer(j));
    }
    if (hits.length===1) return hits[0];
    if (hits.length>1)  return "AMBIGUOUS";
    return null;
  }

  function layerByName(comp, name){
    for (var i=1;i<=comp.numLayers;i++) if (comp.layer(i).name===name) return comp.layer(i);
    return null;
  }

  function easyEase(prop){
    for (var k=1;k<=prop.numKeys;k++){
      prop.setInterpolationTypeAtKey(k,
        KeyframeInterpolationType.BEZIER, KeyframeInterpolationType.BEZIER);
      try { prop.setTemporalEaseAtKey(k, [new KeyframeEase(0,33)], [new KeyframeEase(0,33)]); } catch(e){}
    }
  }

  // the one Position expression that does everything, with this item's literals
  function posExpr(it){
    var tin = STAGGER ? (tIn   + it.i*0.08) : tIn;
    var tfo = STAGGER ? (tForm + it.i*0.08) : tForm;
    return [
      "Cx="+Cx+"; Cy="+Cy+"; R="+R+"; N="+N+";",
      "i="+it.i+"; fx="+it.fx+"; fy="+it.fy+";",
      "tIn="+tin+"; tForm="+tfo+"; tOrbitEnd="+tOrbitEnd+"; tLand="+tLand+";",
      "base = i*2*Math.PI/N;",
      "twoTurns = 2*2*Math.PI;",
      "ringX = Cx + R*Math.cos(base);",
      "ringY = Cy + R*Math.sin(base);",
      "var px, py;",
      "if (time < tIn) {",                                   // parked off-screen right
      "  var cx = Cx + 1500;",
      "  px = cx + R*Math.cos(base); py = Cy + R*Math.sin(base);",
      "} else if (time < tForm) {",                          // fly in -> form ring
      "  var cx = ease(time, tIn, tForm, Cx+1500, Cx);",
      "  px = cx + R*Math.cos(base); py = Cy + R*Math.sin(base);",
      "} else if (time < tOrbitEnd) {",                      // orbit 2 full turns
      "  var spin = ease(time, tForm, tOrbitEnd, 0, twoTurns);",
      "  var a = base + spin;",
      "  px = Cx + R*Math.cos(a); py = Cy + R*Math.sin(a);",
      "} else if (time < tLand) {",                          // peel off -> grid
      "  px = ease(time, tOrbitEnd, tLand, ringX, fx);",
      "  py = ease(time, tOrbitEnd, tLand, ringY, fy);",
      "} else {",                                            // settled in grid
      "  px = fx; py = fy;",
      "}",
      "[px, py, 0]"
    ].join("\n");
  }

  // apply the expressions to an existing item layer (no creation/rename/delete)
  function applyToItem(lyr, it){
    var is3D = lyr.threeDLayer;
    lyr.property("Transform").property("Position").expression = posExpr(it);

    if (ADD_SELF_SPIN){
      var rot = is3D ? lyr.property("Transform").property("Z Rotation")
                     : lyr.property("Transform").property("Rotation");
      rot.expression = "ease(time, "+tForm+", "+tOrbitEnd+", 0, 360*2)";
    }
    if (ADD_SETTLE_BOUNCE){
      var end = (tLand+0.3);
      lyr.property("Transform").property("Scale").expression =
        "s=100; if (time>"+tLand+" && time<"+end+") { s=100+8*Math.sin((time-"+tLand+")/0.3*Math.PI); } "
        + (is3D ? "[s,s,s]" : "[s,s]");
    }
  }

  function makeText(comp, str, pos, name){
    if (layerByName(comp, TAG+name)) return "exists";  // don't clobber a prior build
    var t = comp.layers.addText(str);
    t.name = TAG + name;
    var p = t.property("Transform").property("Position");
    p.setValueAtTime(TEXT_IN_START, [pos[0]+120, pos[1]]);
    p.setValueAtTime(TEXT_IN_END,   [pos[0],     pos[1]]);
    easyEase(p);
    var o = t.property("Transform").property("Opacity");
    o.setValueAtTime(TEXT_IN_START, 0);
    o.setValueAtTime(TEXT_IN_END,  100);
    easyEase(o);
    return "created";
  }

  // ------------------------------ run -------------------------------------
  var comp = findComp(COMP_NAME);
  if (!comp){
    alert("Step 2 build: no comp found.\nOpen your Scene 2 comp (make it active) or set COMP_NAME.");
    return;
  }

  app.beginUndoGroup("Build Step 2 elements");
  var done=[], missing=[], ambiguous=[];
  try {
    for (var k=0;k<ITEMS.length;k++){
      var it = ITEMS[k];
      var L = matchLayer(comp, it.name);
      if (L === "AMBIGUOUS")      { ambiguous.push(it.name); }
      else if (L)                 { applyToItem(L, it); done.push(it.name+" -> "+L.name+" ("+it.label+")"); }
      else                        { missing.push(it.name); }
    }
    if (BUILD_TEXT){
      makeText(comp, TITLE_TEXT,  TITLE_POS,  "title");
      makeText(comp, PROMPT_TEXT, PROMPT_POS, "prompt");
    }
  } catch(err){
    alert("Step 2 build error:\n" + err.toString());
  }
  app.endUndoGroup();

  var msg = "Step 2 build — comp: " + comp.name + "\n\n"
          + "Applied to " + done.length + " item(s):\n  " + (done.join("\n  ") || "(none)");
  if (missing.length)   msg += "\n\nNOT FOUND (rename the layer or fix ITEMS[].name):\n  " + missing.join(", ");
  if (ambiguous.length) msg += "\n\nAMBIGUOUS (multiple layers match — rename to be unique):\n  " + ambiguous.join(", ");
  alert(msg);

})();
