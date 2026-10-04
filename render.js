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

  root.BlockRender = {
    render: render,
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
