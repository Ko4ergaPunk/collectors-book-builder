/* Mod jar analyzer: reads a Minecraft mod jar in the browser (no libraries).
   Extracts items/blocks, localized names and full block models (elements + textures). */
(function (root) {
  "use strict";

  var BR = root.BlockRender;

  /* ---------------- ZIP reader ---------------- */
  function u16(d, o) { return d[o] | (d[o + 1] << 8); }
  function u32(d, o) { return (d[o] | (d[o + 1] << 8) | (d[o + 2] << 16) | (d[o + 3] << 24)) >>> 0; }

  function Zip(bytes) {
    this.bytes = bytes;
    this.entries = new Map();
    this._parseCentralDirectory();
  }
  Zip.prototype._parseCentralDirectory = function () {
    var d = this.bytes;
    var eocd = -1;
    for (var i = d.length - 22; i >= 0 && i >= d.length - 22 - 65536; i--) {
      if (d[i] === 0x50 && d[i + 1] === 0x4b && d[i + 2] === 0x05 && d[i + 3] === 0x06) { eocd = i; break; }
    }
    if (eocd < 0) throw new Error("Не похоже на ZIP/JAR файл");
    var count = u16(d, eocd + 10);
    var offset = u32(d, eocd + 16);
    var p = offset;
    for (var n = 0; n < count; n++) {
      if (u32(d, p) !== 0x02014b50) break;
      var method = u16(d, p + 10);
      var csize = u32(d, p + 20);
      var usize = u32(d, p + 24);
      var fnLen = u16(d, p + 28);
      var exLen = u16(d, p + 30);
      var cmLen = u16(d, p + 32);
      var local = u32(d, p + 42);
      var name = utf8(d, p + 46, fnLen);
      this.entries.set(name, { method: method, csize: csize, usize: usize, local: local });
      p += 46 + fnLen + exLen + cmLen;
    }
  };
  Zip.prototype.list = function () { return Array.from(this.entries.keys()); };
  Zip.prototype.has = function (name) { return this.entries.has(name); };
  Zip.prototype.read = async function (name) {
    var e = this.entries.get(name);
    if (!e) return null;
    var d = this.bytes;
    if (u32(d, e.local) !== 0x04034b50) throw new Error("bad local header: " + name);
    var fnLen = u16(d, e.local + 26);
    var exLen = u16(d, e.local + 28);
    var start = e.local + 30 + fnLen + exLen;
    var raw = d.subarray(start, start + e.csize);
    if (e.method === 0) return new Uint8Array(raw);
    if (e.method === 8) {
      var stream = new Blob([raw]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
      var buf = await new Response(stream).arrayBuffer();
      return new Uint8Array(buf);
    }
    throw new Error("unsupported compression method " + e.method);
  };
  Zip.prototype.text = async function (name) {
    var b = await this.read(name);
    return b ? utf8(b, 0, b.length) : null;
  };
  function utf8(bytes, off, len) { return new TextDecoder("utf-8").decode(bytes.subarray(off, off + len)); }

  /* ---------------- model resolution ---------------- */
  function normalizeRef(r) { return r ? (r.indexOf(":") >= 0 ? r : "minecraft:" + r) : null; }
  function texPathFull(ref) { return BR.texPath(ref); }

  function pickModelFromItemDef(j) {
    var m = j && j.model;
    if (!m) return null;
    function one(x) { if (!x) return null; if (typeof x === "string") return x; if (x.model) return x.model; return null; }
    var t = m.type;
    if (t === "minecraft:model") return one(m);
    if (t === "minecraft:composite") return one(m.models && m.models[0]);
    if (t === "minecraft:select") { if (m.cases && m.cases.length) { var c = m.cases[0]; return one(c && c.model ? c.model : c); } return one(m.fallback); }
    if (t === "minecraft:range_dispatch") { if (m.entries && m.entries.length) return one(m.entries[0].model); return one(m.fallback); }
    if (t === "minecraft:condition") return one(m.on_true) || one(m.on_false);
    return one(m);
  }

  async function loadModel(zip, ref) {
    var i = ref.indexOf(":");
    var ns = ref.slice(0, i), p = ref.slice(i + 1);
    if (ns === "minecraft") return BR.VANILLA_MODELS[p] || null;
    var file = "assets/" + ns + "/models/" + p + ".json";
    if (zip.has(file)) { try { return JSON.parse(await zip.text(file)); } catch (e) { return null; } }
    return null;
  }

  async function resolveModel(zip, ref) {
    var seen = {}, chain = [], cur = normalizeRef(ref), fallback = null;
    while (cur && !seen[cur]) {
      seen[cur] = 1;
      var m = await loadModel(zip, cur);
      if (!m) { fallback = cur; break; }
      chain.unshift({ ref: cur, m: m });
      cur = m.parent ? normalizeRef(m.parent) : null;
    }
    if (!chain.length) return { shape: "cube", tex: {} };

    var merged = {}, elements = null;
    chain.forEach(function (c) {
      var mm = c.m;
      if (mm.textures) for (var k in mm.textures) merged[k] = mm.textures[k];
      if (mm.elements) elements = mm.elements;
    });

    function resolveVar(v, depth) {
      if (!v || depth > 8) return null;
      if (v.charAt(0) === "#") { var key = v.slice(1); return merged[key] != null ? resolveVar(merged[key], depth + 1) : null; }
      return v;
    }
    var tex = {};
    Object.keys(merged).forEach(function (k) {
      var r = resolveVar(merged[k], 0);
      if (r) { var path = texPathFull(r); if (zip.has(path)) tex[k] = path; }
    });

    if (elements) {
      var els = JSON.parse(JSON.stringify(elements));
      els.forEach(function (el) {
        if (!el.faces) return;
        for (var f in el.faces) {
          var ft = el.faces[f].texture, r2 = ft ? resolveVar(ft, 0) : null;
          el.faces[f].texture = (r2 && zip.has(texPathFull(r2))) ? texPathFull(r2) : null;
        }
      });
      return { elements: els, tex: tex };
    }
    var hint = fallback || ref;
    return { shape: BR.inferShape(hint), tex: tex, parent: hint };
  }

  function firstModelFromBlockstate(j) {
    function m(x) {
      if (!x) return null;
      if (typeof x === "string") return x;
      if (Array.isArray(x)) return m(x[0]);
      return x.model || null;
    }
    if (j.variants) { for (var k in j.variants) { var r = m(j.variants[k]); if (r) return r; } }
    if (j.multipart) { for (var i = 0; i < j.multipart.length; i++) { var r2 = m(j.multipart[i].apply); if (r2) return r2; } }
    return null;
  }
  async function resolveBlockModelRef(zip, ns, p) {
    var bs = "assets/" + ns + "/blockstates/" + p + ".json";
    if (zip.has(bs)) { try { var r = firstModelFromBlockstate(JSON.parse(await zip.text(bs))); if (r) return r; } catch (e) {} }
    var idef = "assets/" + ns + "/items/" + p + ".json";
    if (zip.has(idef)) { try { var r2 = pickModelFromItemDef(JSON.parse(await zip.text(idef))); if (r2) return r2; } catch (e) {} }
    return ns + ":block/" + p;
  }
  async function resolveBlockDescriptor(zip, id) {
    var ns = id.slice(0, id.indexOf(":")), p = id.slice(id.indexOf(":") + 1);
    var ref = await resolveBlockModelRef(zip, ns, p);
    return resolveModel(zip, ref);
  }

  async function resolveFlatTexture(zip, id) {
    var ns = id.slice(0, id.indexOf(":")), p = id.slice(id.indexOf(":") + 1);
    var ref = null;
    var idef = "assets/" + ns + "/items/" + p + ".json";
    if (zip.has(idef)) { try { ref = pickModelFromItemDef(JSON.parse(await zip.text(idef))); } catch (e) {} }
    var desc = ref ? await resolveModel(zip, ref) : { tex: {} };
    var layer0 = desc.tex && (desc.tex.layer0 || desc.tex.all || desc.tex.texture);
    if (layer0) return layer0;
    var cands = ["assets/" + ns + "/textures/item/" + p + ".png", "assets/" + ns + "/textures/block/" + p + ".png"];
    for (var i = 0; i < cands.length; i++) if (zip.has(cands[i])) return cands[i];
    return null;
  }

  /* ---------------- lang / names ---------------- */
  async function loadLang(zip, namespaces) {
    var map = {}, order = ["ru_ru", "en_us"];
    for (var oi = 0; oi < order.length; oi++) {
      var arr = Array.from(namespaces);
      for (var ni = 0; ni < arr.length; ni++) {
        var path = "assets/" + arr[ni] + "/lang/" + order[oi] + ".json";
        if (!zip.has(path)) continue;
        try {
          var obj = JSON.parse(await zip.text(path));
          for (var k in obj) if (!(k in map)) map[k] = obj[k];
        } catch (e) {}
      }
    }
    return map;
  }
  function prettify(p) {
    return p.split(/[_\/]/).map(function (w) { return w ? w.charAt(0).toUpperCase() + w.slice(1) : w; }).join(" ").trim();
  }
  function nameFor(id, kind, lang) {
    var i = id.indexOf(":"), ns = id.slice(0, i), p = id.slice(i + 1);
    var keys = kind === "block" ? ["block." + ns + "." + p, "item." + ns + "." + p] : ["item." + ns + "." + p, "block." + ns + "." + p];
    for (var k = 0; k < keys.length; k++) if (lang[keys[k]]) return lang[keys[k]];
    return prettify(p);
  }

  async function mapLimit(arr, limit, fn) {
    var res = new Array(arr.length), next = 0;
    async function worker() { while (next < arr.length) { var i = next++; res[i] = await fn(arr[i], i); } }
    var ws = [];
    for (var w = 0; w < Math.min(limit, arr.length); w++) ws.push(worker());
    await Promise.all(ws);
    return res;
  }

  /* ---------------- main ---------------- */
  async function analyzeJar(arrayBuffer, fallbackName) {
    var zip = new Zip(new Uint8Array(arrayBuffer));
    var all = zip.list();

    var meta = null;
    if (zip.has("fabric.mod.json")) { try { meta = JSON.parse(await zip.text("fabric.mod.json")); } catch (e) {} }
    else if (zip.has("quilt.mod.json")) { try { meta = JSON.parse(await zip.text("quilt.mod.json")); } catch (e) {} }

    var nsSet = new Set();
    all.forEach(function (n) {
      var m = /^assets\/([^\/]+)\/(?:items|blockstates|models\/item)\//.exec(n);
      if (m && m[1] !== "minecraft") nsSet.add(m[1]);
    });
    if (meta && meta.id) nsSet.add(meta.id);
    var namespaces = Array.from(nsSet);
    var lang = await loadLang(zip, namespaces);

    var itemPaths = [], blockSet = new Set(), itemFallback = [];
    all.forEach(function (n) {
      var m = /^assets\/([^\/]+)\/items\/(.+)\.json$/.exec(n);
      if (m && nsSet.has(m[1])) itemPaths.push(m[1] + ":" + m[2]);
      var b = /^assets\/([^\/]+)\/blockstates\/(.+)\.json$/.exec(n);
      if (b && nsSet.has(b[1])) blockSet.add(b[1] + ":" + b[2]);
      var mi = /^assets\/([^\/]+)\/models\/item\/(.+)\.json$/.exec(n);
      if (mi && nsSet.has(mi[1])) itemFallback.push(mi[1] + ":" + mi[2]);
    });

    var ids = new Map();
    if (itemPaths.length) itemPaths.forEach(function (id) { ids.set(id, blockSet.has(id) ? "block" : "item"); });
    else itemFallback.forEach(function (id) { ids.set(id, blockSet.has(id) ? "block" : "item"); });
    blockSet.forEach(function (id) { if (!ids.has(id)) ids.set(id, "block"); });

    var textures = {};
    async function ensureTex(path) {
      if (!path || textures[path] || !zip.has(path)) return;
      textures[path] = await zip.read(path);
    }
    function collectPaths(desc) {
      var s = {};
      if (desc.tex) for (var k in desc.tex) s[desc.tex[k]] = 1;
      if (desc.elements) desc.elements.forEach(function (el) { if (el.faces) for (var f in el.faces) if (el.faces[f].texture) s[el.faces[f].texture] = 1; });
      return Object.keys(s);
    }

    var idList = Array.from(ids.keys());
    var items = await mapLimit(idList, 5, async function (id) {
      var kind = ids.get(id);
      var name = nameFor(id, kind, lang);
      if (kind === "item") {
        var flat = null;
        try { flat = await resolveFlatTexture(zip, id); } catch (e) {}
        if (flat) { await ensureTex(flat); return { id: id, name: name, kind: "item", render: "flat", texture: flat, model: null }; }
        var d = { shape: "cube", tex: {} };
        try { d = await resolveBlockDescriptor(zip, id); } catch (e) {}
        var paths = collectPaths(d);
        for (var i = 0; i < paths.length; i++) await ensureTex(paths[i]);
        return { id: id, name: name, kind: "item", render: "model", texture: null, model: d };
      }
      // block
      var desc = null;
      try { desc = await resolveBlockDescriptor(zip, id); } catch (e) {}
      if (!desc) desc = { shape: "cube", tex: {} };
      var ps = collectPaths(desc);
      for (var j = 0; j < ps.length; j++) await ensureTex(ps[j]);
      var hasTex = Object.keys(desc.tex || {}).length > 0;
      if (!desc.elements && !hasTex) {
        var f = null;
        try { f = await resolveFlatTexture(zip, id); } catch (e) {}
        if (f) { await ensureTex(f); return { id: id, name: name, kind: "block", render: "flat", texture: f, model: null }; }
      }
      return { id: id, name: name, kind: "block", render: "model", texture: null, model: desc };
    });

    var label = (meta && meta.name) || (meta && meta.id) || fallbackName || namespaces[0] || "mod";
    var key = (meta && meta.id) || namespaces[0] || fallbackName || "mod";
    return {
      key: key,
      id: (meta && meta.id) || namespaces[0] || "",
      name: label,
      version: (meta && meta.version) || "",
      namespaces: namespaces,
      items: items,
      textures: textures
    };
  }

  root.ModEngine = { Zip: Zip, analyzeJar: analyzeJar };
})(typeof window !== "undefined" ? window : globalThis);
