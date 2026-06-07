// ============================================================================
// LoadDash — Step 2 DIAGNOSTIC + FORCE-VISIBLE
// ----------------------------------------------------------------------------
// Does NOT animate. It:
//   1. Inspects each of the 6 item layers and writes a full report
//      (found? index, enabled, hasVideo, 3D, in/out, opacity, scale, position,
//       expression error) to an alert AND to a .txt on your Desktop.
//   2. Removes any position/rotation/scale expressions on those layers and
//      PINS all 6 to a visible 3x2 grid centered on the camera (~x2976,y540),
//      opacity 100, scale 100, enabled, full-duration — so they MUST be visible
//      if they render at all.
//   3. Moves the playhead to 31.4s.
//
// If they show now -> the animation/timing was the issue (we'll re-apply).
// If still nothing -> it's occlusion or the source; the report tells us which.
//
// Undo (Cmd+Z) reverts everything this does.
// ============================================================================

(function () {
  var NAMES = [
    "loaddash_item_yard-debris",
    "loaddash_item_other",
    "loaddash_item_bagged-trash",
    "loaddash_item_donation",
    "loaddash_item_furniture",
    "loaddash_item_cardboard"
  ];

  // camera-framed center (from your Camera 2: x2976, y540 at the hold)
  var CX = 2976, CY = 540;
  var GX = [-500, 0, 500];   // 3 columns
  var GY = [-220, 220];      // 2 rows

  function findComp(){
    var a = app.project.activeItem;
    return (a && (a instanceof CompItem)) ? a : null;
  }
  function matchLayer(comp, base){
    var b = base.toLowerCase();
    for (var i=1;i<=comp.numLayers;i++){
      var n = comp.layer(i).name.toLowerCase();
      if (n===b || n===b+".png" || n.indexOf(b)!==-1) return comp.layer(i);
    }
    return null;
  }
  function clearExpr(lyr, prop){
    try { var p=lyr.property("Transform").property(prop); if (p && p.canSetExpression) p.expression=""; } catch(e){}
  }
  function fmt(v){ if (v===undefined||v===null) return "?"; if (v.length){ var s=[]; for(var i=0;i<v.length;i++) s.push((v[i]).toFixed?v[i].toFixed(1):v[i]); return "["+s.join(",")+"]"; } return (v.toFixed?v.toFixed(1):v); }

  var comp = findComp();
  if (!comp){ alert("No active comp. Open Main Comp and re-run."); return; }

  var lines = [];
  lines.push("COMP: " + comp.name + "   " + comp.width + "x" + comp.height
             + "   dur=" + comp.duration.toFixed(1) + "s   fps=" + (1/comp.frameDuration).toFixed(2));
  lines.push("active camera at 31.4s: " + (function(){
      comp.time = 31.4; var c = comp.activeCamera; return c ? c.name : "(none — no camera active!)";
  })());
  lines.push("");

  app.beginUndoGroup("Step 2 diagnostic / force visible");
  var t = 31.4;
  for (var k=0;k<NAMES.length;k++){
    var L = matchLayer(comp, NAMES[k]);
    if (!L){ lines.push("MISSING: " + NAMES[k]); continue; }

    var pos = L.property("Transform").property("Position");
    var op  = L.property("Transform").property("Opacity");
    var sc  = L.property("Transform").property("Scale");

    lines.push("#"+L.index+" "+L.name);
    lines.push("   enabled="+L.enabled+"  hasVideo="+L.hasVideo+"  3D="+L.threeDLayer
               +"  in="+L.inPoint.toFixed(1)+" out="+L.outPoint.toFixed(1));
    lines.push("   BEFORE  pos="+fmt(pos.valueAtTime(t,false))+"  op="+fmt(op.value)+"  scale="+fmt(sc.value));
    lines.push("   posExprErr="+(pos.expressionError||"(none)"));

    // ---- force visible ----
    clearExpr(L,"Position"); clearExpr(L,"Rotation");
    clearExpr(L,"X Rotation"); clearExpr(L,"Y Rotation"); clearExpr(L,"Z Rotation");
    clearExpr(L,"Scale"); clearExpr(L,"Opacity");
    L.enabled = true;
    L.inPoint = 0; L.outPoint = comp.duration;
    var x = CX + GX[k % 3];
    var y = CY + GY[Math.floor(k/3) % 2];
    pos.setValue(L.threeDLayer ? [x,y,0] : [x,y]);
    op.setValue(100);
    sc.setValue(L.threeDLayer ? [100,100,100] : [100,100]);
    lines.push("   PINNED  pos="+fmt(pos.value));
    lines.push("");
  }
  comp.time = t;
  app.endUndoGroup();

  var report = lines.join("\n");

  // write to Desktop
  try {
    var f = new File(Folder.desktop.fsName + "/Step2_diagnostic.txt");
    f.open("w"); f.write(report); f.close();
    report += "\n\n(Saved to Desktop/Step2_diagnostic.txt)";
  } catch(e){}

  alert(report);
})();
