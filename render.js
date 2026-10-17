/* Isometric Minecraft block-model renderer (canvas 2D).
   Renders resolved block models: elements (cuboids with per-face textures),
   with built-in approximations for common vanilla parent templates. */
(function (root) {
  "use strict";

  var SQ3 = Math.sqrt(3);
  var D = [1 / SQ3, 1 / SQ3, -1 / SQ3];      // view direction (toward camera)
  var R = [-0.70710678, 0, -0.70710678];     // screen right
  var U = [-0.40824829, 0.81649658, 0.40824829]; // screen up
  var SHADE = { up: 1.0, down: 0.5, north: 0.8, south: 0.8, east: 0.6, west: 0.6 };

  function project(p) {
    return {
      x: p[0] * R[0] + p[1] * R[1] + p[2] * R[2],
      y: -(p[0] * U[0] + p[1] * U[1] + p[2] * U[2]),
      z: p[0] * D[0] + p[1] * D[1] + p[2] * D[2]
    };
  }

  function texPath(ref) {
    if (!ref) return null;
    var i = ref.indexOf(":");
    var ns = i < 0 ? "minecraft" : ref.slice(0, i);
    var p = i < 0 ? ref : ref.slice(i + 1);
    return "assets/" + ns + "/textures/" + p + ".png";
  }

  /* face vertex orders: [p0..p3] */
  function vDown(f, t) { return [[f[0], f[1], f[2]], [f[0], f[1], t[2]], [t[0], f[1], t[2]], [t[0], f[1], f[2]]]; }
  function vUp(f, t) { return [[f[0], t[1], t[2]], [f[0], t[1], f[2]], [t[0], t[1], f[2]], [t[0], t[1], t[2]]]; }
  function vNorth(f, t) { return [[t[0], t[1], f[2]], [f[0], t[1], f[2]], [f[0], f[1], f[2]], [t[0], f[1], f[2]]]; }
  function vSouth(f, t) { return [[f[0], t[1], t[2]], [t[0], t[1], t[2]], [t[0], f[1], t[2]], [f[0], f[1], t[2]]]; }
  function vWest(f, t) { return [[f[0], t[1], f[2]], [f[0], t[1], t[2]], [f[0], f[1], t[2]], [f[0], f[1], f[2]]]; }
  function vEast(f, t) { return [[t[0], t[1], t[2]], [t[0], t[1], f[2]], [t[0], f[1], f[2]], [t[0], f[1], t[2]]]; }
  var VERTS = { down: vDown, up: vUp, north: vNorth, south: vSouth, west: vWest, east: vEast };

  function defaultUV(face, f, t) {
    var x1 = f[0], y1 = f[1], z1 = f[2], x2 = t[0], y2 = t[1], z2 = t[2];
    switch (face) {
      case "down": return [x1, 16 - z2, x2, 16 - z1];
      case "up": return [x1, z1, x2, z2];
      case "north": return [16 - x2, 16 - y2, 16 - x1, 16 - y1];
      case "south": return [x1, 16 - y2, x2, 16 - y1];
      case "west": return [z1, 16 - y2, z2, 16 - y1];
      case "east": return [16 - z2, 16 - y2, 16 - z1, 16 - y1];
    }
    return [0, 0, 16, 16];
  }

  function rotatePoint(p, o, axis, deg) {
    var a = deg * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
    var x = p[0] - o[0], y = p[1] - o[1], z = p[2] - o[2], nx, ny, nz;
    if (axis === "x") { nx = x; ny = y * c - z * s; nz = y * s + z * c; }
    else if (axis === "y") { nx = x * c + z * s; ny = y; nz = -x * s + z * c; }
    else { nx = x * c - y * s; ny = x * s + y * c; nz = z; }
    return [nx + o[0], ny + o[1], nz + o[2]];
  }

  /* ---------------- built-in templates ---------------- */
  function box(from, to, faceTex) {
    var faces = {};
    for (var f in faceTex) { if (faceTex[f]) faces[f] = { uv: [0, 0, 16, 16], texture: faceTex[f] }; }
    return { from: from, to: to, faces: faces };
  }
  function cubeEl(v) {
    return box([0, 0, 0], [16, 16, 16], {
      down: v.down || v.all, up: v.up || v.all, north: v.north || v.all,
      south: v.south || v.all, east: v.east || v.all, west: v.west || v.all
    });
  }
  var ALL_FACES = ["down", "up", "north", "south", "east", "west"];
  function faceSet(tex) {
    var faces = {};
    ALL_FACES.forEach(function (f) { faces[f] = tex; });
    return faces;
  }
  function el(from, to, faceTex) {
    var faces = {};
    for (var f in faceTex) faces[f] = { texture: faceTex[f] };
    return { from: from, to: to, faces: faces };
  }
  function crossElements(tex) {
    if (!tex) tex = "#cross";
    return [
      { from: [0.8, 0, 8], to: [15.2, 16, 8], shade: false, faces: { north: { uv: [0, 0, 16, 16], texture: tex }, south: { uv: [0, 0, 16, 16], texture: tex } } },
      { from: [8, 0, 0.8], to: [8, 16, 15.2], shade: false, faces: { east: { uv: [0, 0, 16, 16], texture: tex }, west: { uv: [0, 0, 16, 16], texture: tex } } }
    ];
  }
  function signElements(tex) {
    if (!tex) tex = "#all";
    return [
      { from: [7, 0, 7], to: [9, 8, 9], faces: { down: { texture: tex }, up: { texture: tex }, north: { texture: tex }, south: { texture: tex }, east: { texture: tex }, west: { texture: tex } } },
      { from: [0, 8, 7], to: [16, 15, 9], shade: false, faces: { north: { uv: [0, 0, 16, 16], texture: tex }, south: { uv: [0, 0, 16, 16], texture: tex }, up: { texture: tex }, down: { texture: tex }, east: { texture: tex }, west: { texture: tex } } }
    ];
  }
  function slabElements(tex) {
    return [box([0, 0, 0], [16, 8, 16], { down: tex, up: tex, north: tex, south: tex, east: tex, west: tex })];
  }
  function stairsElements(tex) {
    return [
      box([0, 0, 0], [16, 8, 16], { down: tex, up: tex, north: tex, south: tex, east: tex, west: tex }),
      box([0, 8, 8], [16, 16, 16], { down: tex, up: tex, north: tex, south: tex, east: tex, west: tex })
    ];
  }
  function thinElements(tex) {
    return [box([7, 0, 0], [9, 16, 16], { down: tex, up: tex, north: tex, south: tex, east: tex, west: tex })];
  }
  function carpetElements(tex) {
    return [box([0, 0, 0], [16, 1, 16], { down: tex, up: tex, north: tex, south: tex, east: tex, west: tex })];
  }
  function doorElements(tex) {
    return [box([0, 0, 6], [3, 16, 10], { down: tex, up: tex, north: tex, south: tex, east: tex, west: tex })];
  }
  function trapdoorElements(tex) {
    return [box([0, 13, 0], [16, 16, 16], { down: tex, up: tex, north: tex, south: tex, east: tex, west: tex })];
  }

  var VANILLA_MODELS = {
    "block/cube_all": { textures: { particle: "#all" }, elements: [cubeEl({ all: "#all" })] },
    "block/cube_mirrored_all": { textures: { particle: "#all" }, elements: [cubeEl({ all: "#all" })] },
    "block/cube": { textures: { particle: "#north" }, elements: [cubeEl({ down: "#down", up: "#up", north: "#north", south: "#south", east: "#east", west: "#west" })] },
    "block/cube_bottom_top": { textures: { particle: "#side" }, elements: [cubeEl({ down: "#bottom", up: "#top", all: "#side" })] },
    "block/cube_top": { textures: { particle: "#side" }, elements: [cubeEl({ down: "#side", up: "#top", all: "#side" })] },
    "block/cube_column": { textures: { particle: "#side" }, elements: [cubeEl({ down: "#end", up: "#end", all: "#side" })] },
    "block/cube_column_horizontal": { textures: { particle: "#side" }, elements: [cubeEl({ down: "#end", up: "#end", all: "#side" })] },
    "block/cube_directional": { textures: { particle: "#side" }, elements: [cubeEl({ down: "#side", up: "#side", north: "#side", south: "#side", east: "#side", west: "#side" })] },
    "block/orientable": { textures: { particle: "#top" }, elements: [cubeEl({ down: "#top", up: "#top", north: "#front", all: "#side" })] },
    "block/orientable_with_bottom": { textures: { particle: "#top" }, elements: [cubeEl({ down: "#bottom", up: "#top", north: "#front", all: "#side" })] },
    "block/orientable_with_tinted_emissive": { textures: { particle: "#top" }, elements: [cubeEl({ down: "#bottom", up: "#top", north: "#front", all: "#side" })] },
    "block/cross": { textures: { particle: "#cross" }, elements: crossElements("#cross") },
    "block/crop": { textures: { particle: "#crop" }, elements: crossElements("#crop") },
    "block/tinted_cross": { textures: { particle: "#cross" }, elements: crossElements("#cross") },
    "block/template_potted_flower": { textures: { particle: "#dirt" }, elements: [cubeEl({ all: "#dirt" })] }
  };

  var SIDE = { down: "#bottom", up: "#top", north: "#side", south: "#side", west: "#side", east: "#side" };
  VANILLA_MODELS["block/slab"] = { textures: { particle: "#side" }, elements: [el([0, 0, 0], [16, 8, 16], SIDE)] };
  VANILLA_MODELS["block/slab_top"] = { textures: { particle: "#side" }, elements: [el([0, 8, 0], [16, 16, 16], SIDE)] };
  VANILLA_MODELS["block/stairs"] = { textures: { particle: "#side" }, elements: [
    el([0, 0, 0], [16, 8, 16], SIDE),
    el([8, 8, 0], [16, 16, 16], { up: "#top", north: "#side", south: "#side", west: "#side", east: "#side" })
  ] };
  VANILLA_MODELS["block/inner_stairs"] = { textures: { particle: "#side" }, elements: [
    el([0, 0, 0], [16, 8, 16], SIDE),
    el([8, 8, 0], [16, 16, 16], { up: "#top", north: "#side", south: "#side", west: "#side", east: "#side" }),
    el([0, 8, 8], [8, 16, 16], { up: "#top", north: "#side", south: "#side", west: "#side" })
  ] };
  VANILLA_MODELS["block/outer_stairs"] = { textures: { particle: "#side" }, elements: [
    el([0, 0, 0], [16, 8, 16], SIDE),
    el([8, 8, 8], [16, 16, 16], { up: "#top", north: "#side", south: "#side", west: "#side", east: "#side" })
  ] };

  VANILLA_MODELS["block/fence_post"] = { textures: { particle: "#texture" }, elements: [el([6, 0, 6], [10, 16, 10], faceSet("#texture"))] };
  VANILLA_MODELS["block/fence_side"] = { textures: { particle: "#texture" }, elements: [
    el([7, 12, 0], [9, 15, 9], faceSet("#texture")),
    el([7, 6, 0], [9, 9, 9], faceSet("#texture"))
  ] };
  VANILLA_MODELS["block/fence_inventory"] = { textures: { particle: "#texture" }, elements: [
    el([6, 0, 0], [10, 16, 4], faceSet("#texture")),
    el([6, 0, 12], [10, 16, 16], faceSet("#texture")),
    el([7, 12, 0], [9, 15, 16], { down: "#texture", up: "#texture", west: "#texture", east: "#texture" }),
    el([7, 6, 0], [9, 9, 16], { down: "#texture", up: "#texture", west: "#texture", east: "#texture" })
  ] };
  VANILLA_MODELS["block/template_fence_gate"] = { textures: { particle: "#texture" }, elements: [
    el([0, 5, 7], [2, 16, 9], faceSet("#texture")),
    el([14, 5, 7], [16, 16, 9], faceSet("#texture")),
    el([6, 6, 7], [8, 15, 9], faceSet("#texture")),
    el([8, 6, 7], [10, 15, 9], faceSet("#texture")),
    el([2, 6, 7], [6, 9, 9], faceSet("#texture")),
    el([10, 6, 7], [14, 9, 9], faceSet("#texture")),
    el([2, 12, 7], [6, 15, 9], faceSet("#texture")),
    el([10, 12, 7], [14, 15, 9], faceSet("#texture"))
  ] };

  VANILLA_MODELS["block/button"] = { textures: { particle: "#texture" }, elements: [el([5, 0, 6], [11, 2, 10], faceSet("#texture"))] };
  VANILLA_MODELS["block/button_inventory"] = { textures: { particle: "#texture" }, elements: [el([5, 6, 6], [11, 10, 10], faceSet("#texture"))] };
  VANILLA_MODELS["block/button_pressed"] = { textures: { particle: "#texture" }, elements: [el([5, 0, 6], [11, 1.02, 10], faceSet("#texture"))] };
  VANILLA_MODELS["block/pressure_plate_up"] = { textures: { particle: "#texture" }, elements: [el([1, 0, 1], [15, 1, 15], faceSet("#texture"))] };
  VANILLA_MODELS["block/pressure_plate_down"] = { textures: { particle: "#texture" }, elements: [el([1, 0, 1], [15, 0.5, 15], faceSet("#texture"))] };

  VANILLA_MODELS["block/wall_inventory"] = { textures: { particle: "#wall" }, elements: [
    el([4, 0, 4], [12, 16, 12], faceSet("#wall")),
    el([5, 0, 0], [11, 13, 16], faceSet("#wall"))
  ] };
  VANILLA_MODELS["block/template_wall_post"] = { textures: { particle: "#wall" }, elements: [el([4, 0, 4], [12, 16, 12], faceSet("#wall"))] };
  VANILLA_MODELS["block/template_wall_side"] = { textures: { particle: "#wall" }, elements: [el([5, 0, 0], [11, 14, 8], faceSet("#wall"))] };
  VANILLA_MODELS["block/template_wall_side_tall"] = { textures: { particle: "#wall" }, elements: [el([5, 0, 0], [11, 16, 8], faceSet("#wall"))] };

  VANILLA_MODELS["block/lever"] = { textures: { particle: "#base", base: "minecraft:block/cobblestone", lever: "minecraft:block/lever" }, elements: [
    el([5, -0.02, 4], [11, 2.98, 12], faceSet("#base")),
    { from: [7, 1, 7], to: [9, 11, 9], rotation: { origin: [8, 1, 8], axis: "x", angle: -45 }, faces: { down: { texture: "#lever" }, up: { texture: "#lever" }, north: { texture: "#lever" }, south: { texture: "#lever" }, east: { texture: "#lever" }, west: { texture: "#lever" } } }
  ] };
  VANILLA_MODELS["block/lever_on"] = { textures: { particle: "#base", base: "minecraft:block/cobblestone", lever: "minecraft:block/lever" }, elements: [
    el([5, -0.02, 4], [11, 2.98, 12], faceSet("#base")),
    { from: [7, 1, 7], to: [9, 11, 9], rotation: { origin: [8, 1, 8], axis: "x", angle: 45 }, faces: { down: { texture: "#lever" }, up: { texture: "#lever" }, north: { texture: "#lever" }, south: { texture: "#lever" }, east: { texture: "#lever" }, west: { texture: "#lever" } } }
  ] };

  // sign templates all map to a simple board
  [
    "template_sign_rot_0", "template_sign_rot_1", "template_sign_rot_2", "template_sign_rot_3",
    "template_wall_sign",
    "template_hanging_sign_rot_0", "template_hanging_sign_rot_1", "template_hanging_sign_rot_2", "template_hanging_sign_rot_3",
    "template_attached_hanging_sign_rot_0", "template_attached_hanging_sign_rot_1", "template_attached_hanging_sign_rot_2", "template_attached_hanging_sign_rot_3",
    "template_wall_hanging_sign"
  ].forEach(function (n) {
    VANILLA_MODELS["block/" + n] = { textures: { particle: "#all" }, elements: signElements("#all") };
  });

  function inferShape(name) {
    name = (name || "").toLowerCase();
    if (/(cross|crop|mushroom|flower|sapling|plant|berry|bud|stalk|vine|root|bush|petal|clover)/.test(name)) return "cross";
    if (/sign/.test(name)) return "sign";
    if (/slab/.test(name)) return "slab";
    if (/stair/.test(name)) return "stairs";
    if (/(fence|wall|pane|bars|chain|rod|torch|lantern|ladder)/.test(name)) return "thin";
    if (/(carpet|rug|thin|rail)/.test(name)) return "carpet";
    if (/trapdoor/.test(name)) return "trapdoor";
    if (/door/.test(name)) return "door";
    return "cube";
  }

  function pick(tex, keys) {
    if (!tex) return null;
    for (var i = 0; i < keys.length; i++) if (tex[keys[i]]) return tex[keys[i]];
    for (var k in tex) if (k !== "particle") return tex[k];
    for (var k2 in tex) return tex[k2];
    return null;
  }
  function shapeElements(shape, tex) {
    if (shape === "cross") return crossElements(pick(tex, ["cross", "all", "texture", "side", "particle"]));
    if (shape === "sign") return signElements(pick(tex, ["all", "texture", "side", "particle"]));
    if (shape === "slab") { var s = pick(tex, ["side", "all", "texture", "particle"]); return slabElements(s); }
    if (shape === "stairs") { var st = pick(tex, ["side", "all", "texture", "particle"]); return stairsElements(st); }
    if (shape === "thin") { var th = pick(tex, ["side", "all", "texture", "particle"]); return thinElements(th); }
    if (shape === "carpet") { var cp = pick(tex, ["all", "top", "side", "texture", "particle"]); return carpetElements(cp); }
    if (shape === "door") { var dr = pick(tex, ["side", "all", "texture", "particle"]); return doorElements(dr); }
    if (shape === "trapdoor") { var tr = pick(tex, ["side", "all", "texture", "particle"]); return trapdoorElements(tr); }
    // default cube
    var side = pick(tex, ["side", "all", "texture", "front", "particle"]);
    var top = pick(tex, ["top", "up", "all", "side", "particle"]);
    var bottom = pick(tex, ["bottom", "down", "all", "side", "particle"]);
    var front = pick(tex, ["front", "north", "all", "side", "particle"]);
    return [box([0, 0, 0], [16, 16, 16], {
      down: bottom || side, up: top || side, north: front || side,
      south: side, east: side, west: side
    })];
  }

  /* ---------------- shaded texture cache ---------------- */
  var shadeCache = {};
  function shadedImage(path, shade, getImage) {
    var key = path + "|" + shade;
    if (shadeCache[key]) return shadeCache[key];
    var img = getImage(path);
    if (!img || !img.naturalWidth) return null;
    var iw = img.naturalWidth, ih = img.naturalHeight;
    var cv = document.createElement("canvas");
    cv.width = iw; cv.height = ih;
    var c = cv.getContext("2d");
    c.imageSmoothingEnabled = false;
    c.drawImage(img, 0, 0);
    if (shade < 1) {
      c.globalCompositeOperation = "source-atop";
      c.fillStyle = "rgba(0,0,0," + (1 - shade).toFixed(3) + ")";
      c.fillRect(0, 0, iw, ih);
    }
    shadeCache[key] = cv;
    return cv;
  }

  function drawFace(ctx, fa, getImage) {
    var p = fa.proj, C = fa.C;
    if (!p[0] || !p[3]) return;
    var img = fa.tex ? shadedImage(fa.tex, fa.shade, getImage) : null;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(p[0].x, p[0].y);
    ctx.lineTo(p[1].x, p[1].y);
    ctx.lineTo(p[2].x, p[2].y);
    ctx.lineTo(p[3].x, p[3].y);
    ctx.closePath();
    if (img) {
      ctx.clip();
      var iw = img.width, ih = img.height;
      var u0 = C[0].u / 16 * iw, v0 = C[0].v / 16 * ih;
      var du = (C[1].u - C[0].u) / 16 * iw, dv = (C[3].v - C[0].v) / 16 * ih;
      if (du !== 0 && dv !== 0) {
        var a = (p[1].x - p[0].x) / du, b = (p[1].y - p[0].y) / du;
        var c2 = (p[3].x - p[0].x) / dv, d2 = (p[3].y - p[0].y) / dv;
        var e = p[0].x - a * u0 - c2 * v0, f2 = p[0].y - b * u0 - d2 * v0;
        if (isFinite(a) && isFinite(b) && isFinite(c2) && isFinite(d2)) {
          ctx.setTransform(a, b, c2, d2, e, f2);
          ctx.imageSmoothingEnabled = false;
          ctx.drawImage(img, 0, 0);
          ctx.setTransform(1, 0, 0, 1, 0, 0);
        }
      }
    } else {
      ctx.fillStyle = "#6f7a86";
      ctx.fill();
    }
    ctx.restore();
  }

  function paintFaces(ctx, faces, W, H, getImage) {
    if (!faces.length) return;
    var minx = Infinity, maxx = -Infinity, miny = Infinity, maxy = -Infinity;
    faces.forEach(function (fa) { fa.proj.forEach(function (q) { if (q.x < minx) minx = q.x; if (q.x > maxx) maxx = q.x; if (q.y < miny) miny = q.y; if (q.y > maxy) maxy = q.y; }); });
    if (!isFinite(minx)) return;
    var span = Math.max(maxx - minx, maxy - miny) || 1;
    var scale = (Math.min(W, H) * 0.84) / span;
    var cx = (minx + maxx) / 2, cy = (miny + maxy) / 2;
    faces.forEach(function (fa) {
      fa.proj.forEach(function (q) { q.x = (q.x - cx) * scale + W / 2; q.y = (q.y - cy) * scale + H / 2; });
    });
    faces.sort(function (a, b) { return a.depth - b.depth; });
    faces.forEach(function (fa) { drawFace(ctx, fa, getImage); });
  }

  /* ---------------- GeckoLib / Bedrock geometry ---------------- */
  var GD = [1 / SQ3, 1 / SQ3, 1 / SQ3];      // view direction (toward camera, +X+Y+Z)
  var GR = [0.70710678, 0, -0.70710678];     // screen right
  var GU = [-0.40824829, 0.81649658, -0.40824829]; // screen up
  function gproject(p) {
    return {
      x: p[0] * GR[0] + p[1] * GR[1] + p[2] * GR[2],
      y: -(p[0] * GU[0] + p[1] * GU[1] + p[2] * GU[2]),
      z: p[0] * GD[0] + p[1] * GD[1] + p[2] * GD[2]
    };
  }

  /* 4x4 column-major matrices */
  function mIdent() { return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]; }
  function mMul(a, b) {
    var r = new Array(16);
    for (var c = 0; c < 4; c++) for (var row = 0; row < 4; row++) {
      var s = 0;
      for (var k = 0; k < 4; k++) s += a[k * 4 + row] * b[c * 4 + k];
      r[c * 4 + row] = s;
    }
    return r;
  }
  function mTrans(x, y, z) { var m = mIdent(); m[12] = x; m[13] = y; m[14] = z; return m; }
  function mRotX(a) { var c = Math.cos(a), s = Math.sin(a); return [1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, 0, 0, 0, 1]; }
  function mRotY(a) { var c = Math.cos(a), s = Math.sin(a); return [c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1]; }
  function mRotZ(a) { var c = Math.cos(a), s = Math.sin(a); return [c, s, 0, 0, -s, c, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]; }
  var RAD = Math.PI / 180;
  // GeckoLib negates the X and Y rotation values when baking Bedrock geometry
  function mEuler(rot) {
    var rx = -(rot[0] || 0) * RAD, ry = -(rot[1] || 0) * RAD, rz = (rot[2] || 0) * RAD;
    if (!rx && !ry && !rz) return mIdent();
    return mMul(mMul(mRotZ(rz), mRotY(ry)), mRotX(rx));
  }
  function mApply(m, p) {
    return [
      m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12],
      m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13],
      m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14]
    ];
  }
  function pivotMatrix(pivot, rot) {
    // GeckoLib mirrors the model on X: pivots become (-x, y, z)
    var p = pivot || [0, 0, 0];
    var px = -p[0], py = p[1], pz = p[2];
    return mMul(mTrans(px, py, pz), mMul(mEuler(rot || [0, 0, 0]), mTrans(-px, -py, -pz)));
  }
  function faceVerts(from, to) {
    var x0 = from[0], y0 = from[1], z0 = from[2], x1 = to[0], y1 = to[1], z1 = to[2];
    var BLB = [x0, y0, z0], BRB = [x0, y0, z1], TLB = [x0, y1, z0], TRB = [x0, y1, z1];
    var TLF = [x1, y1, z0], TRF = [x1, y1, z1], BLF = [x1, y0, z0], BRF = [x1, y0, z1];
    return {
      west: [TRB, TLB, BLB, BRB],
      east: [TLF, TRF, BRF, BLF],
      north: [TLB, TLF, BLF, BLB],
      south: [TRF, TRB, BRB, BRF],
      up: [TRB, TRF, TLF, TLB],
      down: [BLB, BLF, BRF, BRB]
    };
  }
  function rotateUVs(deg, u, v, uW, vH) {
    switch (((deg % 360) + 360) % 360) {
      case 90: return [uW, v, uW, vH, u, vH, u, v];
      case 180: return [uW, vH, u, vH, u, v, uW, v];
      case 270: return [u, vH, u, v, uW, v, uW, vH];
      default: return [u, v, uW, v, uW, vH, u, vH];
    }
  }
  function naturalFaceSize(fname, s) {
    if (fname === "west" || fname === "east") return [s[2], s[1]];
    if (fname === "up" || fname === "down") return [s[0], s[2]];
    return [s[0], s[1]];
  }
  function skipZeroFace(s, fname) {
    if (s[0] === 0 && fname !== "west" && fname !== "east") return true;
    if (s[1] === 0 && fname !== "up" && fname !== "down") return true;
    if (s[2] === 0 && fname !== "north" && fname !== "south") return true;
    return false;
  }

  function buildGeoFaces(geo) {
    var facesOut = [];
    var texW = geo.textureWidth || 64, texH = geo.textureHeight || 64;
    var bones = geo.bones || [];
    var byName = {}, wcache = {};
    bones.forEach(function (b) { if (b && b.name) byName[b.name] = b; });
    function world(name, guard) {
      if (wcache[name]) return wcache[name];
      var b = byName[name];
      if (!b || guard > 32) return mIdent();
      var parent = b.parent && byName[b.parent] ? world(b.parent, (guard || 0) + 1) : mIdent();
      wcache[name] = mMul(parent, pivotMatrix(b.pivot, b.rotation));
      return wcache[name];
    }

    bones.forEach(function (bone) {
      if (!bone || !bone.cubes) return;
      var bw = world(bone.name, 0);
      var boneMirror = bone.mirror === true;
      bone.cubes.forEach(function (cube) {
        if (!cube || !cube.origin || !cube.size) return;
        var s = cube.size, o = cube.origin;
        var infl = cube.inflate != null ? cube.inflate : (bone.inflate || 0);
        // GeckoLib bakes the cube with the X axis mirrored: origin.x' = -(origin.x + size.x)
        var from = [-(o[0] + s[0]) - infl, o[1] - infl, o[2] - infl];
        var to = [-o[0] + infl, o[1] + s[1] + infl, o[2] + s[2] + infl];
        var mirror = cube.mirror != null ? cube.mirror === true : boneMirror;
        var cp = cube.pivot || [o[0] + s[0] / 2, o[1] + s[1] / 2, o[2] + s[2] / 2];
        var M = mMul(bw, pivotMatrix(cp, cube.rotation));
        var verts = faceVerts(from, to);
        var uv = cube.uv;
        var boxUV = !uv || Array.isArray(uv);
        ["west", "east", "north", "south", "up", "down"].forEach(function (fname) {
          if (skipZeroFace(s, fname)) return;
          var rect, rotation = 0;
          if (boxUV) {
            var u = (uv || [0, 0])[0], v = (uv || [0, 0])[1], sx = s[0], sy = s[1], sz = s[2];
            if (fname === "west") rect = [u + sz + sx, v + sz, sz, sy];
            else if (fname === "east") rect = [u, v + sz, sz, sy];
            else if (fname === "north") rect = [u + sz, v + sz, sx, sy];
            else if (fname === "south") rect = [u + sz + sx + sz, v + sz, sx, sy];
            else if (fname === "up") rect = [u + sz, v, sx, sz];
            else rect = [u + sz + sx, v + sz, sx, -sz];
          } else {
            var d = uv[fname];
            if (!d) return;
            var uu = d.uv || [0, 0];
            var ds = d.uv_size || naturalFaceSize(fname, s);
            rect = [uu[0], uu[1], ds[0], ds[1]];
            rotation = d.uv_rotation != null ? d.uv_rotation : (d.rotation || 0);
          }
          var u0 = rect[0], v0 = rect[1], w = rect[2], h = rect[3];
          if (!w || !h) return;
          var uA = u0 / texW, vA = v0 / texH, uB = (u0 + w) / texW, vB = (v0 + h) / texH;
          if (uA === uB || vA === vB) return;
          if (!mirror) { var tmp = uA; uA = uB; uB = tmp; }
          var uvs = rotateUVs(rotation, uA, vA, uB, vB);
          var vertList = verts[fname];
          if (mirror) {
            if (fname === "west") vertList = verts.east;
            else if (fname === "east") vertList = verts.west;
            else if (!boxUV && fname === "up") vertList = verts.down;
            else if (!boxUV && fname === "down") vertList = verts.up;
          }
          var corners = [
            { p: mApply(M, vertList[0]), u: uvs[0], v: uvs[1] },
            { p: mApply(M, vertList[1]), u: uvs[2], v: uvs[3] },
            { p: mApply(M, vertList[2]), u: uvs[4], v: uvs[5] },
            { p: mApply(M, vertList[3]), u: uvs[6], v: uvs[7] }
          ];
          var umin = Math.min(corners[0].u, corners[1].u, corners[2].u, corners[3].u);
          var umax = Math.max(corners[0].u, corners[1].u, corners[2].u, corners[3].u);
          var vmin = Math.min(corners[0].v, corners[1].v, corners[2].v, corners[3].v);
          var vmax = Math.max(corners[0].v, corners[1].v, corners[2].v, corners[3].v);
          function find(u, v) {
            for (var i = 0; i < 4; i++) if (Math.abs(corners[i].u - u) < 1e-9 && Math.abs(corners[i].v - v) < 1e-9) return corners[i];
            return null;
          }
          var ordered = [find(umin, vmin), find(umax, vmin), find(umax, vmax), find(umin, vmax)];
          if (!ordered[0] || !ordered[1] || !ordered[2] || !ordered[3]) return;
          var depth = 0;
          var proj = ordered.map(function (c) {
            depth += c.p[0] * GD[0] + c.p[1] * GD[1] + c.p[2] * GD[2];
            return gproject(c.p);
          });
          var C = ordered.map(function (c) { return { u: c.u * 16, v: c.v * 16 }; });
          facesOut.push({
            proj: proj, C: C, tex: geo.texture || null,
            shade: SHADE[fname] != null ? SHADE[fname] : 1,
            depth: depth
          });
        });
      });
    });
    return facesOut;
  }

  function renderGeo(canvas, geo, getImage) {
    var W = canvas.width, H = canvas.height;
    var ctx = canvas.getContext("2d");
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.imageSmoothingEnabled = false;
    if (!geo) return;
    paintFaces(ctx, buildGeoFaces(geo), W, H, getImage);
  }

  function render(canvas, desc, getImage) {
    var W = canvas.width, H = canvas.height;
    var ctx = canvas.getContext("2d");
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.imageSmoothingEnabled = false;
    if (!desc) return;
    var elements = desc.elements || shapeElements(desc.shape, desc.tex || {});
    var faces = [];
    elements.forEach(function (el) {
      if (!el || !el.faces || !el.from || !el.to) return;
      var from = el.from, to = el.to, rot = el.rotation;
      var shadeOn = el.shade !== false;
      for (var fname in el.faces) {
        var fd = el.faces[fname];
        var verts = VERTS[fname] ? VERTS[fname](from, to) : null;
        if (!verts) continue;
        if (rot) verts = verts.map(function (q) { return rotatePoint(q, rot.origin, rot.axis, rot.angle); });
        var uv = fd.uv || defaultUV(fname, from, to);
        var C = [{ u: uv[0], v: uv[1] }, { u: uv[2], v: uv[1] }, { u: uv[2], v: uv[3] }, { u: uv[0], v: uv[3] }];
        var r = fd.rotation || 0;
        for (var i = 0; i < r / 90; i++) C = [C[3], C[0], C[1], C[2]];
        var pts = verts.map(function (q) { return [q[0] - 8, q[1] - 8, q[2] - 8]; });
        var proj = pts.map(project);
        var depth = 0;
        pts.forEach(function (q) { depth += (q[0] + q[1] - q[2]); });
        faces.push({
          proj: proj, C: C, tex: fd.texture,
          shade: shadeOn ? (SHADE[fname] != null ? SHADE[fname] : 1) : 1,
          depth: depth
        });
      }
    });
    if (!faces.length) return;
    paintFaces(ctx, faces, W, H, getImage);
  }

  root.BlockRender = {
    render: render,
    renderGeo: renderGeo,
    buildGeoFaces: buildGeoFaces,
    shapeElements: shapeElements,
    crossElements: crossElements,
    signElements: signElements,
    cubeEl: cubeEl,
    box: box,
    inferShape: inferShape,
    texPath: texPath,
    VANILLA_MODELS: VANILLA_MODELS
  };
})(typeof window !== "undefined" ? window : globalThis);
