// ============================================================================
// LoadDash — Scene 2 / Step 2 "Choose your items"  ELEMENT BUILD
// ----------------------------------------------------------------------------
// Builds the Step 2 elements onto your existing Scene 2 comp:
//   - "STEP 2" title  +  "pick your items" prompt  (animate in)
//   - 6 item layers, each carrying the ring -> orbit(x2) -> land Position expr
//   - optional self-spin (Rotation) and settle-bounce (Scale)
//
// Camera 2, Card 2, and the navy background are assumed ALREADY in the comp
// (per the spec they're done / unchanged) — this script does NOT touch them.
//
// HOW TO RUN
//   1. Open / make active your Scene 2 comp.
//   2. File > Scripts > Run Script File...  ->  pick this file.
//      (or in Claude Desktop: "run this script via run-script")
//   3. Re-run safely: it removes any layers it created on a prior run first.
//
// ITEM ART
//   - Set ITEM_ART_FOLDER to a folder containing <name>.png to import real art.
//   - Otherwise each item is a labeled placeholder solid you can replace later.
// ============================================================================

(function () {

  // ============================ CONFIG ====================================
  var COMP_NAME        = "";      // "" = active comp, or e.g. "Scene 2"
  var ITEM_ART_FOLDER  = "";      // "" = placeholder solids; else "/path/to/pngs"
  var MAKE_3D          = true;    // items/text as 3D (needed if framed by camera)
  var ADD_SELF_SPIN    = true;    // Rotation: tumble twice during the orbit
  var ADD_SETTLE_BOUNCE= true;    // Scale: small overshoot when it lands
  var STAGGER          = false;   // arrive ~2 frames apart (adds i*0.08 to tIn/tForm)

  // ring + timing (from the spec)
  var Cx = 3260, Cy = 540, R = 320, N = 6;
  var tIn = 28.8, tForm = 29.4, tOrbitEnd = 31.4, tLand = 32.4;

  // 6 items: name, i (ring slot 0..5), fx/fy (final 2x3 grid spot)
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

  var TAG = "S2_";   // marks layers this script makes (for safe re-runs)
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

  function findFootage(base){
    base = base.toLowerCase();
    for (var i=1;i<=app.project.numItems;i++){
      var it=app.project.item(i);
      if (it instanceof FootageItem){
        var n=it.name.toLowerCase();
        if (n===base || n===base+".png" || n.indexOf(base)===0) return it;
      }
    }
    return null;
  }

  function removeOldBuild(comp){
    for (var i=comp.numLayers; i>=1; i--){
      var L=comp.layer(i);
      if (L.name.indexOf(TAG)===0) L.remove();
    }
  }

  function easyEase(prop){
    for (var k=1;k<=prop.numKeys;k++){
      prop.setInterpolationTypeAtKey(k,
        KeyframeInterpolationType.BEZIER, KeyframeInterpolationType.BEZIER);
      try {
        prop.setTemporalEaseAtKey(k, [new KeyframeEase(0,33)], [new KeyframeEase(0,33)]);
      } catch(e){}
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

  function makeItem(comp, it){
    var lyr=null;

    if (ITEM_ART_FOLDER){
      var f = new File(ITEM_ART_FOLDER + "/" + it.name + ".png");
      if (f.exists){
        try { lyr = comp.layers.add(app.project.importFile(new ImportOptions(f))); } catch(e){}
      }
    }
    if (!lyr){
      var foot = findFootage(it.name);
      if (foot) lyr = comp.layers.add(foot);
    }
    if (!lyr){
      lyr = comp.layers.addSolid([0.85,0.86,0.92], it.name, 240, 240, comp.pixelAspect);
    }

    lyr.name = TAG + it.name;
    if (MAKE_3D) lyr.threeDLayer = true;

    lyr.property("Transform").property("Position").expression = posExpr(it);

    if (ADD_SELF_SPIN){
      var rot = MAKE_3D ? lyr.property("Transform").property("Z Rotation")
                        : lyr.property("Transform").property("Rotation");
      rot.expression = "ease(time, "+tForm+", "+tOrbitEnd+", 0, 360*2)";
    }
    if (ADD_SETTLE_BOUNCE){
      var end = (tLand+0.3);
      lyr.property("Transform").property("Scale").expression =
        "s=100; if (time>"+tLand+" && time<"+end+") { s=100+8*Math.sin((time-"+tLand+")/0.3*Math.PI); } "
        + (MAKE_3D ? "[s,s,s]" : "[s,s]");
    }
    return lyr;
  }

  function makeText(comp, str, pos, name){
    var t = comp.layers.addText(str);
    t.name = TAG + name;
    if (MAKE_3D) t.threeDLayer = true;

    var p = t.property("Transform").property("Position");
    var s = MAKE_3D ? [pos[0]+120, pos[1], 0] : [pos[0]+120, pos[1]];
    var e = MAKE_3D ? [pos[0],     pos[1], 0] : [pos[0],     pos[1]];
    p.setValueAtTime(TEXT_IN_START, s);
    p.setValueAtTime(TEXT_IN_END,   e);
    easyEase(p);

    var o = t.property("Transform").property("Opacity");
    o.setValueAtTime(TEXT_IN_START, 0);
    o.setValueAtTime(TEXT_IN_END,  100);
    easyEase(o);
    return t;
  }

  // ------------------------------ run -------------------------------------
  var comp = findComp(COMP_NAME);
  if (!comp){
    alert("Step 2 build: no comp found.\nOpen your Scene 2 comp (make it active) or set COMP_NAME.");
    return;
  }

  app.beginUndoGroup("Build Step 2 elements");
  try {
    removeOldBuild(comp);                       // clean previous run
    makeText(comp, TITLE_TEXT,  TITLE_POS,  "title");
    makeText(comp, PROMPT_TEXT, PROMPT_POS, "prompt");
    for (var k=0;k<ITEMS.length;k++) makeItem(comp, ITEMS[k]);
  } catch(err){
    alert("Step 2 build error:\n" + err.toString());
  }
  app.endUndoGroup();

})();
