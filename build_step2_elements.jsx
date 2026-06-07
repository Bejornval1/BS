// ============================================================================
// LoadDash — Scene 2 / Step 2 "Choose your items"  — 2D SCREEN-SPACE BUILD
// ----------------------------------------------------------------------------
// Builds Scene 2 in flat 2D screen space (1920x1080), camera-independent:
//   - CARD ("Step 2"): 2D, 50% scale, at 212.9 , 576.4 (left)
//   - 6 ITEMS: 2D, fly in from the right, orbit two smooth circles, land in a
//     2x3 grid on the right; optional self-spin + settle bounce
//   - "STEP 2" title + "pick your items" prompt (created if missing)
//
// Non-destructive: never duplicates/renames/deletes your layers. Re-run safe.
// HOW TO RUN: make Main Comp active -> File > Scripts > Run Script File...
// ============================================================================

(function () {

  // ============================ CONFIG ====================================
  var COMP_NAME   = "";          // "" = active comp

  // CARD
  var CARD_NAME   = "Step 2";    // the card layer (the Step 2 PNG)
  var CARD_SCALE  = 50;          // %
  var CARD_POS    = [212.9, 576.4];

  // ITEM ANIMATION (all in 1920x1080 screen space)
  var Cx = 1250, Cy = 540, R = 240, N = 6;     // ring center + radius (right side)
  var PARK_OFF = 900;                          // how far off-screen-right they start
  var tIn = 28.8, tForm = 29.4, tOrbitEnd = 31.4, tLand = 32.4;
  var ITEM_SCALE = 35;           // % size of each item
  var ADD_SELF_SPIN = true;      // items tumble twice as the ring turns
  var ADD_SETTLE_BOUNCE = true;  // little overshoot on landing
  var STAGGER = false;           // arrive ~2 frames apart

  // 6 items: name, ring slot i (0..5), final grid spot (screen px)
  var ITEMS = [
    { name:"loaddash_item_yard-debris",  i:5, fx:1000, fy:380, label:"top-left"     },
    { name:"loaddash_item_other",        i:4, fx:1280, fy:380, label:"top-center"   },
    { name:"loaddash_item_bagged-trash", i:0, fx:1560, fy:380, label:"top-right"    },
    { name:"loaddash_item_donation",     i:2, fx:1000, fy:700, label:"bottom-left"  },
    { name:"loaddash_item_furniture",    i:3, fx:1280, fy:700, label:"bottom-center"},
    { name:"loaddash_item_cardboard",    i:1, fx:1560, fy:700, label:"bottom-right" }
  ];

  // TEXT
  var BUILD_TEXT = true;
  var TITLE_TEXT = "STEP 2",  PROMPT_TEXT = "pick your items";
  var TITLE_POS  = [1180, 150], PROMPT_POS = [1180, 250];
  var TEXT_IN_START = 27.8, TEXT_IN_END = 28.5;

  var TAG = "S2_";
  // ========================================================================


  function findComp(name){
    if (name){ for (var i=1;i<=app.project.numItems;i++){ var it=app.project.item(i);
      if (it instanceof CompItem && it.name===name) return it; } return null; }
    var a=app.project.activeItem; return (a && (a instanceof CompItem)) ? a : null;
  }
  function exactLayer(comp, name){
    var n=name.toLowerCase();
    for (var i=1;i<=comp.numLayers;i++) if (comp.layer(i).name.toLowerCase()===n) return comp.layer(i);
    return null;
  }
  function matchLayer(comp, base){
    var b=base.toLowerCase(), exts=["",".png",".psd",".ai",".jpg",".jpeg",".tif"];
    for (var e=0;e<exts.length;e++){ var t=b+exts[e];
      for (var i=1;i<=comp.numLayers;i++) if (comp.layer(i).name.toLowerCase()===t) return comp.layer(i); }
    var hits=[]; for (var j=1;j<=comp.numLayers;j++) if (comp.layer(j).name.toLowerCase().indexOf(b)!==-1) hits.push(comp.layer(j));
    if (hits.length===1) return hits[0]; if (hits.length>1) return "AMBIGUOUS"; return null;
  }
  function easyEase(prop){
    for (var k=1;k<=prop.numKeys;k++){
      prop.setInterpolationTypeAtKey(k, KeyframeInterpolationType.BEZIER, KeyframeInterpolationType.BEZIER);
      try { prop.setTemporalEaseAtKey(k, [new KeyframeEase(0,33)], [new KeyframeEase(0,33)]); } catch(e){}
    }
  }

  // 2D position expression: park right -> fly in -> orbit 2 turns -> land in grid
  function posExpr(it){
    var tin = STAGGER ? (tIn+it.i*0.08) : tIn;
    var tfo = STAGGER ? (tForm+it.i*0.08) : tForm;
    return [
      "var Cx="+Cx+", Cy="+Cy+", R="+R+", N="+N+", off="+PARK_OFF+";",
      "var i="+it.i+", fx="+it.fx+", fy="+it.fy+";",
      "var tIn="+tin+", tForm="+tfo+", tOrbitEnd="+tOrbitEnd+", tLand="+tLand+";",
      "var base=i*2*Math.PI/N, twoTurns=2*2*Math.PI;",
      "var ringX=Cx+R*Math.cos(base), ringY=Cy+R*Math.sin(base);",
      "var px,py;",
      "if (time<tIn){ px=(Cx+off)+R*Math.cos(base); py=ringY; }",
      "else if (time<tForm){ var cx=ease(time,tIn,tForm,Cx+off,Cx); px=cx+R*Math.cos(base); py=ringY; }",
      "else if (time<tOrbitEnd){ var a=base+ease(time,tForm,tOrbitEnd,0,twoTurns); px=Cx+R*Math.cos(a); py=Cy+R*Math.sin(a); }",
      "else if (time<tLand){ px=ease(time,tOrbitEnd,tLand,ringX,fx); py=ease(time,tOrbitEnd,tLand,ringY,fy); }",
      "else { px=fx; py=fy; }",
      "[px,py]"
    ].join("\n");
  }

  function applyItem(lyr, it){
    lyr.threeDLayer = false;                     // 2D screen space
    if (lyr.inPoint  > tIn)   lyr.inPoint  = tIn - 0.5;
    if (lyr.outPoint < tLand) lyr.outPoint = tLand + 1.0;
    lyr.enabled = true;
    lyr.property("Transform").property("Position").expression = posExpr(it);
    if (ADD_SELF_SPIN)
      lyr.property("Transform").property("Rotation").expression = "ease(time,"+tForm+","+tOrbitEnd+",0,360*2)";
    var s;
    if (ADD_SETTLE_BOUNCE){ var end=(tLand+0.3);
      s = "var s="+ITEM_SCALE+"; if (time>"+tLand+" && time<"+end+"){ s="+ITEM_SCALE+"+("+ITEM_SCALE+"*0.08)*Math.sin((time-"+tLand+")/0.3*Math.PI); } [s,s]";
    } else { s = "["+ITEM_SCALE+","+ITEM_SCALE+"]"; }
    lyr.property("Transform").property("Scale").expression = s;
  }

  function makeText(comp, str, pos, name){
    if (exactLayer(comp, TAG+name)) return;
    var t=comp.layers.addText(str); t.name=TAG+name; t.threeDLayer=false;
    var p=t.property("Transform").property("Position");
    p.setValueAtTime(TEXT_IN_START,[pos[0]+120,pos[1]]); p.setValueAtTime(TEXT_IN_END,[pos[0],pos[1]]); easyEase(p);
    var o=t.property("Transform").property("Opacity");
    o.setValueAtTime(TEXT_IN_START,0); o.setValueAtTime(TEXT_IN_END,100); easyEase(o);
  }

  // ------------------------------ run -------------------------------------
  var comp = findComp(COMP_NAME);
  if (!comp){ alert("No comp. Open Main Comp and re-run."); return; }

  app.beginUndoGroup("Build Scene 2 (2D)");
  var report=[], missing=[], ambiguous=[];

  // CARD
  var card = exactLayer(comp, CARD_NAME) || matchLayer(comp, CARD_NAME);
  if (card && card!=="AMBIGUOUS"){
    card.threeDLayer = false;
    card.property("Transform").property("Scale").setValue([CARD_SCALE,CARD_SCALE]);
    card.property("Transform").property("Position").setValue(CARD_POS);
    report.push("CARD #"+card.index+" "+card.name+" -> 2D, "+CARD_SCALE+"%, ["+CARD_POS[0]+","+CARD_POS[1]+"]");
  } else {
    report.push("CARD '"+CARD_NAME+"' "+(card==="AMBIGUOUS"?"AMBIGUOUS":"NOT FOUND"));
  }

  // ITEMS
  for (var k=0;k<ITEMS.length;k++){
    var L = matchLayer(comp, ITEMS[k].name);
    if (L==="AMBIGUOUS") ambiguous.push(ITEMS[k].name);
    else if (L){ applyItem(L, ITEMS[k]); report.push("  #"+L.index+" "+L.name+" ("+ITEMS[k].label+")"); }
    else missing.push(ITEMS[k].name);
  }
  if (BUILD_TEXT){ makeText(comp,TITLE_TEXT,TITLE_POS,"title"); makeText(comp,PROMPT_TEXT,PROMPT_POS,"prompt"); }
  app.endUndoGroup();

  try { comp.time = Math.min(tOrbitEnd, comp.duration - comp.frameDuration); } catch(e){}

  var msg = "Scene 2 (2D) — "+comp.name+"  "+comp.width+"x"+comp.height
          + "  (playhead -> "+comp.time.toFixed(1)+"s)\n\n" + report.join("\n");
  if (missing.length)   msg += "\n\nITEMS NOT FOUND: "+missing.join(", ");
  if (ambiguous.length) msg += "\n\nAMBIGUOUS: "+ambiguous.join(", ");
  alert(msg);

})();
