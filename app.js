(function () {
  "use strict";

  var MC = window.MC_DATA || { items: [], categories: {} };
  var SPRITE_W = 1440, SPRITE_H = 2736, CELL = 48;

  var entries = new Map();       // id -> {id,name,source,kind,cat,sx,sy,tex}
  var MODS = [];                 // [{key,name,version,id,items:[{id,name,kind,texture,tex}],textureKeys}]
  var modTexUrls = {};           // texture name -> objectURL
  var activeTab = "all";         // 'all' | 'vanilla' | mod key
  var editTab = "normal";        // 'normal' | 'event'

  var STORAGE_KEY = "collectionsbook.config.v1";
  var config = null;

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  function t(key, vars) { return window.I18N.t(key, vars); }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  /* ---------- entries ---------- */
  function buildEntries() {
    entries = new Map();
    MC.items.forEach(function (it) {
      entries.set(it.id, { id: it.id, name: it.name, source: "vanilla", kind: null, cat: it.cat, sx: it.sx, sy: it.sy });
    });
    MODS.forEach(function (m) {
      m.items.forEach(function (it) {
        entries.set(it.id, {
          id: it.id, name: it.name, source: m.key,
          kind: it.kind, cat: it.kind === "block" ? 2 : 1,
          tex: it.texture ? modTexUrls[it.texture] || null : null,
          render: it.render || (it.kind === "item" ? "flat" : "model"),
          model: it.model || null
        });
      });
    });
  }

  /* ---------- texture images ---------- */
  var imageCache = {};
  function getImage(path) { var v = imageCache[path]; return (v && v !== "missing") ? v : null; }
  function modTexturePaths() {
    var paths = {};
    MODS.forEach(function (m) {
      m.items.forEach(function (it) {
        if (it.texture) paths[it.texture] = 1;
        if (it.model) {
          if (it.model.tex) for (var k in it.model.tex) paths[it.model.tex[k]] = 1;
          if (it.model.elements) it.model.elements.forEach(function (el) { if (el.faces) for (var f in el.faces) if (el.faces[f].texture) paths[el.faces[f].texture] = 1; });
        }
      });
    });
    return Object.keys(paths);
  }
  function preloadImages() {
    var paths = modTexturePaths();
    return Promise.all(paths.map(function (p) {
      if (imageCache[p] !== undefined) return null;
      var url = modTexUrls[p];
      if (!url) { imageCache[p] = "missing"; return null; }
      return new Promise(function (res) {
        var img = new Image();
        img.onload = function () { imageCache[p] = img; res(); };
        img.onerror = function () { imageCache[p] = "missing"; res(); };
        img.src = url;
      });
    }));
  }

  /* ---------- icons ---------- */
  function applySprite(el, entry, size) {
    var r = size / CELL;
    el.style.width = size + "px";
    el.style.height = size + "px";
    el.style.backgroundSize = (SPRITE_W * r) + "px " + (SPRITE_H * r) + "px";
    el.style.backgroundPosition = (parseFloat(entry.sx) * r) + "px " + (parseFloat(entry.sy) * r) + "px";
  }
  function makeIconById(id, size) {
    var entry = entries.get(id);
    if (entry && entry.render === "model" && entry.model && window.BlockRender) {
      var canvas = document.createElement("canvas");
      canvas.width = size * 2;
      canvas.height = size * 2;
      canvas.style.width = size + "px";
      canvas.style.height = size + "px";
      canvas.style.imageRendering = "pixelated";
      canvas.style.display = "block";
      try { window.BlockRender.render(canvas, entry.model, getImage); } catch (e) {}
      return canvas;
    }
    var el = document.createElement("div");
    el.className = "mc-icon";
    if (entry && entry.tex) {
      el.style.width = size + "px";
      el.style.height = size + "px";
      el.style.backgroundImage = 'url("' + entry.tex + '")';
      el.style.backgroundSize = size + "px " + size + "px";
      el.style.backgroundPosition = "center center";
    } else if (entry && entry.sx != null) {
      applySprite(el, entry, size);
    } else {
      el.style.width = size + "px";
      el.style.height = size + "px";
      el.style.background = "#3a424e";
      el.style.borderRadius = "3px";
      el.style.display = "flex";
      el.style.alignItems = "center";
      el.style.justifyContent = "center";
      el.style.fontSize = Math.round(size * 0.6) + "px";
      el.style.color = "#8b97a6";
      el.textContent = "?";
    }
    return el;
  }
  function itemName(id) { var e = entries.get(id); return e ? e.name : id; }

  /* ---------- palette ---------- */
  var paletteEl = $("#palette");
  var paletteSlots = [];
  var paletteCount = $("#paletteCount");
  var searchEl = $("#search");
  var catFilter = $("#catFilter");
  var paletteTabs = $("#paletteTabs");

  function buildPalette() {
    paletteEl.innerHTML = "";
    paletteSlots = [];
    var frag = document.createDocumentFragment();
    entries.forEach(function (entry) {
      var slot = document.createElement("div");
      slot.className = "slot";
      slot.draggable = true;
      slot.title = entry.name + "\n" + entry.id;
      slot.dataset.id = entry.id;
      slot.dataset.search = (entry.name + " " + entry.id).toLowerCase();
      slot._entry = entry;

      slot.appendChild(makeIconById(entry.id, 40));

      var tip = document.createElement("div");
      tip.className = "slot__name";
      tip.innerHTML = esc(entry.name) + "<small>" + esc(entry.id) + "</small>";
      slot.appendChild(tip);

      slot.addEventListener("dragstart", function (e) {
        drag = { kind: "new", item: entry.id };
        try {
          e.dataTransfer.setData("text/plain", entry.id);
          e.dataTransfer.effectAllowed = "copy";
        } catch (err) {}
        slot.classList.add("dragging");
      });
      slot.addEventListener("dragend", function () {
        slot.classList.remove("dragging");
        endDrag();
      });

      frag.appendChild(slot);
      paletteSlots.push(slot);
    });
    paletteEl.appendChild(frag);
    refreshPaletteUsage();
  }

  function usedItemSet() {
    var set = {};
    if (!config || !Array.isArray(config.sections)) return set;
    config.sections.forEach(function (s) {
      (s.categories || []).forEach(function (c) {
        (c.items || []).forEach(function (id) { if (id) set[id] = true; });
      });
    });
    return set;
  }
  function refreshPaletteUsage() {
    var used = usedItemSet();
    paletteSlots.forEach(function (slot) {
      if (used[slot.dataset.id]) slot.classList.add("slot_used");
      else slot.classList.remove("slot_used");
    });
  }

  function rebuildTabs() {
    paletteTabs.innerHTML = "";
    addTab("all", t("tab.all"), null);
    addTab("vanilla", t("tab.vanilla"), null);
    MODS.forEach(function (m) {
      addTab(m.key, m.name, m.key);
    });
  }
  function addTab(key, label, unloadKey) {
    var tabEl = document.createElement("div");
    tabEl.className = "tab" + (activeTab === key ? " tab_active" : "");
    tabEl.appendChild(document.createTextNode(label));
    if (unloadKey) {
      var x = document.createElement("span");
      x.className = "tab__x";
      x.textContent = "✕";
      x.title = t("tab.unloadMod");
      x.addEventListener("click", function (e) {
        e.stopPropagation();
        unloadMod(unloadKey);
      });
      tabEl.appendChild(x);
    }
    tabEl.addEventListener("click", function () {
      activeTab = key;
      rebuildTabs();
      rebuildCatFilter();
      applyFilter();
    });
    paletteTabs.appendChild(tabEl);
  }

  function rebuildCatFilter() {
    if (activeTab === "vanilla") {
      catFilter.disabled = false;
      var keys = Object.keys(MC.categories).sort(function (a, b) { return a - b; });
      catFilter.innerHTML = '<option value="">' + esc(t("filter.allCategories")) + "</option>" + keys.map(function (k) {
        return '<option value="' + esc(k) + '">' + esc(MC.categories[k]) + "</option>";
      }).join("");
    } else if (activeTab === "all") {
      catFilter.disabled = true;
      catFilter.innerHTML = '<option value="">' + esc(t("filter.allSources")) + "</option>";
    } else {
      catFilter.disabled = false;
      catFilter.innerHTML = '<option value="">' + esc(t("filter.all")) + '</option><option value="item">' + esc(t("filter.items")) + '</option><option value="block">' + esc(t("filter.blocks")) + "</option>";
    }
  }

  function applyFilter() {
    var q = searchEl.value.trim().toLowerCase();
    var sub = catFilter.value;
    var shown = 0;
    paletteSlots.forEach(function (slot) {
      var e = slot._entry;
      var ok = !q || slot.dataset.search.indexOf(q) !== -1;
      if (ok) {
        if (activeTab === "vanilla") ok = e.source === "vanilla" && (!sub || String(e.cat) === sub);
        else if (activeTab === "all") ok = true;
        else ok = e.source === activeTab && (!sub || e.kind === sub);
      }
      slot.style.display = ok ? "" : "none";
      if (ok) shown++;
    });
    paletteCount.textContent = shown;
    var empty = paletteEl.querySelector(".palette__empty");
    if (shown === 0 && !empty) {
      var d = document.createElement("div");
      d.className = "palette__empty";
      d.textContent = t("palette.none");
      paletteEl.appendChild(d);
    } else if (shown !== 0 && empty) {
      empty.remove();
    }
  }

  /* ---------- IndexedDB ---------- */
  var dbPromise = null;
  function idb() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise(function (res, rej) {
      var r = indexedDB.open("collectionsbook", 1);
      r.onupgradeneeded = function () {
        var db = r.result;
        if (!db.objectStoreNames.contains("mods")) db.createObjectStore("mods", { keyPath: "key" });
        if (!db.objectStoreNames.contains("textures")) db.createObjectStore("textures", { keyPath: "key" });
      };
      r.onsuccess = function () { res(r.result); };
      r.onerror = function () { rej(r.error); };
    });
    return dbPromise;
  }
  function txDone(tx) { return new Promise(function (res, rej) { tx.oncomplete = res; tx.onerror = function () { rej(tx.error); }; tx.onabort = function () { rej(tx.error); }; }); }
  function idbGetAll(store) {
    return idb().then(function (db) {
      return new Promise(function (res, rej) {
        var tx = db.transaction(store, "readonly");
        var req = tx.objectStore(store).getAll();
        req.onsuccess = function () { res(req.result); };
        req.onerror = function () { rej(req.error); };
      });
    });
  }
  function idbDelete(store, key) {
    return idb().then(function (db) {
      var tx = db.transaction(store, "readwrite");
      tx.objectStore(store).delete(key);
      return txDone(tx);
    });
  }

  /* ---------- mods ---------- */
  function revokeTexUrls() {
    Object.keys(modTexUrls).forEach(function (k) { try { URL.revokeObjectURL(modTexUrls[k]); } catch (e) {} });
    modTexUrls = {};
    imageCache = {};
  }
  function reloadMods() {
    revokeTexUrls();
    return idbGetAll("textures").then(function (texs) {
      texs.forEach(function (t) { modTexUrls[t.key] = URL.createObjectURL(t.blob); });
      return idbGetAll("mods");
    }).then(function (mods) {
      MODS = mods.map(function (m) {
        return {
          key: m.key, name: m.name, version: m.version, id: m.id, textureKeys: m.textureKeys || [],
          items: (m.items || []).map(function (it) {
            return { id: it.id, name: it.name, kind: it.kind, texture: it.texture, render: it.render, model: it.model };
          })
        };
      });
      MODS.sort(function (a, b) { return a.name.localeCompare(b.name); });
      return preloadImages();
    }).then(function () {
      buildEntries();
      if (activeTab !== "all" && activeTab !== "vanilla" && !MODS.some(function (m) { return m.key === activeTab; })) activeTab = "all";
      rebuildTabs();
      rebuildCatFilter();
      buildPalette();
      rebuildDatalist();
      applyFilter();
      updateItemTotal();
    });
  }

  function updateItemTotal() {
    var el = $("#itemTotal");
    if (el) el.textContent = entries.size;
  }

  function loadModFile(file) {
    if (!window.ModEngine) { toast(t("toast.modNotFound"), true); return; }
    var busy = toast(t("toast.readingMod", { name: file.name }));
    file.arrayBuffer().then(function (buf) {
      return window.ModEngine.analyzeJar(buf, file.name.replace(/\.jar$/i, ""));
    }).then(function (res) {
      if (!res.items.length) { toast(t("toast.modNoItems"), true); return; }
      return idb().then(function (db) {
        var ttx = db.transaction("textures", "readwrite");
        var tstore = ttx.objectStore("textures");
        var keys = [];
        Object.keys(res.textures).forEach(function (name) {
          tstore.put({ key: name, blob: new Blob([res.textures[name]], { type: "image/png" }) });
          keys.push(name);
        });
        return txDone(ttx).then(function () {
          var mtx = db.transaction("mods", "readwrite");
          mtx.objectStore("mods").put({
            key: res.key, id: res.id, name: res.name, version: res.version,
            namespaces: res.namespaces, items: res.items, textureKeys: keys, loadedAt: Date.now()
          });
          return txDone(mtx);
        });
      }).then(function () {
        activeTab = res.key;
        return reloadMods();
      }).then(function () {
        toast(t("toast.modLoaded", { name: res.name, count: res.items.length }));
      });
    }).catch(function (e) {
      toast(t("toast.modLoadError", { msg: (e && e.message ? e.message : e) }), true);
    });
  }

  function unloadMod(key) {
    var mod = MODS.filter(function (m) { return m.key === key; })[0];
    if (!mod) return;
    if (!confirm(t("confirm.unloadMod", { name: mod.name }))) return;
    idbDelete("mods", key).then(function () {
      return idbGetAll("mods");
    }).then(function (remaining) {
      var used = {};
      remaining.forEach(function (m) { (m.textureKeys || []).forEach(function (k) { used[k] = true; }); });
      var dels = (mod.textureKeys || []).filter(function (k) { return !used[k]; });
      return Promise.all(dels.map(function (k) { return idbDelete("textures", k); }));
    }).then(function () {
      if (activeTab === key) activeTab = "all";
      return reloadMods();
    }).then(function () {
      toast(t("toast.modUnloaded", { name: mod.name }));
    });
  }

  function rebuildDatalist() {
    var dl = $("#itemIdList");
    dl.innerHTML = Array.from(entries.values()).map(function (e) {
      return '<option value="' + esc(e.id) + '">' + esc(e.name) + "</option>";
    }).join("");
  }

  /* ---------- config state helpers ---------- */
  function uid(prefix, existing) {
    var i = 1, set = existing || [];
    while (set.indexOf(prefix + i) !== -1) i++;
    return prefix + i;
  }
  function ensureReward(r) {
    if (!r || typeof r !== "object" || !r.item) return null;
    return { item: r.item, count: Math.max(1, parseInt(r.count, 10) || 1) };
  }
  function ensureRewards(o) {
    var list = [];
    if (Array.isArray(o && o.rewards)) list = o.rewards;
    else if (o && o.reward) list = [o.reward];
    return list.map(ensureReward).filter(Boolean);
  }
  function ensureNames(n) {
    var out = {};
    if (n && typeof n === "object") {
      Object.keys(n).forEach(function (k) {
        var key = String(k).trim();
        if (key && typeof n[k] === "string") out[key] = n[k];
      });
    }
    return out;
  }
  function ensureSection(s) {
    return {
      id: s.id != null ? s.id : uid("section", []),
      name: s.name != null ? s.name : t("default.section"),
      names: ensureNames(s.names),
      icon: s.icon || "icon_bookmark_main",
      gold_icon: s.gold_icon || "",
      event: !!s.event,
      tab_active: s.tab_active || "",
      tab_inactive: s.tab_inactive || "",
      rewards: ensureRewards(s),
      categories: Array.isArray(s.categories) ? s.categories : []
    };
  }
  function ensureCategory(c) {
    return {
      id: c.id != null ? c.id : "category",
      name: c.name != null ? c.name : t("default.category"),
      names: ensureNames(c.names),
      icon: c.icon || "icon_category_plants",
      gold_icon: c.gold_icon || "",
      items: Array.isArray(c.items) ? c.items.filter(function (x) { return typeof x === "string"; }) : [],
      rewards: ensureRewards(c)
    };
  }
  function normalize(cfg) {
    var sections = (cfg && Array.isArray(cfg.sections)) ? cfg.sections : [];
    return { sections: sections.map(function (s) {
      var sec = ensureSection(s);
      sec.categories = sec.categories.map(ensureCategory);
      return sec;
    }) };
  }

  /* ---------- drag state ---------- */
  var drag = null;
  var trash = $("#trash");

  function endDrag() {
    drag = null;
    trash.classList.remove("show");
    $$(".items.over").forEach(function (e) { e.classList.remove("over"); });
    $$(".chip.over").forEach(function (e) { e.classList.remove("over"); });
    $$(".reward.over").forEach(function (e) { e.classList.remove("over"); });
    $$(".category.over").forEach(function (e) { e.classList.remove("over"); });
  }
  function startMoveDrag(e, si, ci, idx, item) {
    drag = { kind: "move", si: si, ci: ci, idx: idx, item: item };
    try {
      e.dataTransfer.setData("text/plain", item);
      e.dataTransfer.effectAllowed = "move";
    } catch (err) {}
    trash.classList.add("show");
  }

  /* ---------- touch drag & drop ---------- */
  function initTouchDnD() {
    var LONG_PRESS = 220;
    var MOVE_CANCEL = 10;
    var state = null;
    var ghost = null;

    function nearestDraggable(node) {
      while (node && node.nodeType === 1) {
        if (node.classList.contains("slot") || node.classList.contains("chip")) return node;
        node = node.parentNode;
      }
      return null;
    }

    function cancel() {
      if (!state) return;
      if (state.timer) { clearTimeout(state.timer); state.timer = null; }
      if (state.source && state.wasDraggable !== undefined) state.source.draggable = state.wasDraggable;
      if (state.active) {
        if (state.source) state.source.classList.remove("dragging");
        if (ghost && ghost.parentNode) ghost.parentNode.removeChild(ghost);
        endDrag();
      }
      state = null;
      ghost = null;
    }

    function activate() {
      if (!state) return;
      state.timer = null;
      state.active = true;
      var src = state.source;
      if (src.classList.contains("slot")) {
        drag = { kind: "new", item: src.dataset.id };
      } else {
        var grid = src.parentElement;
        drag = { kind: "move", si: +grid.dataset.si, ci: +grid.dataset.ci, idx: +src.dataset.idx, item: src.dataset.id };
        trash.classList.add("show");
      }
      src.classList.add("dragging");

      var rect = src.getBoundingClientRect();
      var size = Math.max(36, Math.min(rect.width, 60));
      ghost = document.createElement("div");
      ghost.className = "dnd-ghost";
      ghost.style.width = size + "px";
      ghost.style.height = size + "px";
      ghost.appendChild(makeIconById(drag.item, size));
      document.body.appendChild(ghost);
      moveGhost(state.lastX, state.lastY);

      if (navigator.vibrate) { try { navigator.vibrate(12); } catch (e) {} }
    }

    function moveGhost(x, y) {
      if (!ghost) return;
      ghost.style.left = x + "px";
      ghost.style.top = y + "px";
    }

    function targetAt(x, y) {
      var el = document.elementFromPoint(x, y);
      if (!el || !el.closest) return null;
      if (trash.contains(el)) return trash;
      var reward = el.closest(".reward");
      if (reward) return reward;
      var add = el.closest(".reward_add");
      if (add) return add;
      var grid = el.closest(".items");
      if (grid) return grid;
      return null;
    }

    function highlight(target) {
      $$(".items.over").forEach(function (e) { if (e !== target) e.classList.remove("over"); });
      $$(".reward.over").forEach(function (e) { if (e !== target) e.classList.remove("over"); });
      if (target && target.classList) target.classList.add("over");
    }

    function fireDrop(el, x, y) {
      var ev = document.createEvent("Event");
      ev.initEvent("drop", true, true);
      ev.clientX = x; ev.clientY = y;
      el.dispatchEvent(ev);
    }

    document.addEventListener("touchstart", function (e) {
      if (e.touches.length !== 1 || state) return;
      var el = nearestDraggable(e.target);
      if (!el) return;
      var wasDraggable = el.draggable;
      el.draggable = false;
      var t = e.touches[0];
      state = { source: el, wasDraggable: wasDraggable, startX: t.clientX, startY: t.clientY, lastX: t.clientX, lastY: t.clientY, active: false, timer: null };
      state.timer = setTimeout(activate, LONG_PRESS);
    }, { passive: true });

    document.addEventListener("touchmove", function (e) {
      if (!state) return;
      var t = e.touches[0];
      state.lastX = t.clientX; state.lastY = t.clientY;
      if (!state.active) {
        var dx = t.clientX - state.startX, dy = t.clientY - state.startY;
        if (dx * dx + dy * dy > MOVE_CANCEL * MOVE_CANCEL) cancel();
        return;
      }
      e.preventDefault();
      moveGhost(t.clientX, t.clientY);
      highlight(targetAt(t.clientX, t.clientY));
    }, { passive: false });

    document.addEventListener("touchend", function (e) {
      if (!state || !state.active) { cancel(); return; }
      var t = e.changedTouches[0];
      var target = targetAt(t.clientX, t.clientY);
      if (target) fireDrop(target, t.clientX, t.clientY);
      cancel();
    });

    document.addEventListener("touchcancel", cancel);
  }

  /* ---------- editor ---------- */
  var editorEl = $("#editor");
  var editorTabsEl = $("#editorTabs");

  function render() { renderEditorTabs(); renderEditor(); refreshPaletteUsage(); autosave(); }

  function isTitleSection(sec) { return !!sec && sec.id === "dummy"; }

  function countByType(isEvent) {
    return config.sections.filter(function (s) { return !isTitleSection(s) && !!s.event === isEvent; }).length;
  }
  function renderEditorTabs() {
    editorTabsEl.innerHTML = "";
    [
      { key: "normal", label: t("editor.normal"), cls: "etab_normal", isEvent: false },
      { key: "event", label: t("editor.event"), cls: "etab_event", isEvent: true }
    ].forEach(function (tab) {
      var el = document.createElement("div");
      el.className = "etab " + tab.cls + (editTab === tab.key ? " etab_active" : "");
      el.appendChild(document.createTextNode(tab.label));
      var c = document.createElement("span"); c.className = "etab__count"; c.textContent = countByType(tab.isEvent);
      el.appendChild(c);
      el.title = tab.isEvent ? t("editor.eventTitle") : t("editor.normalTitle");
      el.addEventListener("click", function () {
        if (editTab === tab.key) return;
        editTab = tab.key;
        render();
      });
      editorTabsEl.appendChild(el);
    });
  }

  function renderEditor() {
    editorEl.innerHTML = "";
    var isEvent = editTab === "event";
    var shown = [];
    config.sections.forEach(function (sec, si) { if (!isTitleSection(sec) && !!sec.event === isEvent) shown.push({ sec: sec, si: si }); });

    if (!shown.length) {
      var empty = document.createElement("div");
      empty.className = "empty";
      empty.innerHTML = "<h2>" + esc(isEvent ? t("editor.noEvent") : t("editor.noConfig")) + "</h2><p>" +
        esc(isEvent ? t("editor.noEventHint") : t("editor.noConfigHint")) + "</p>";
      editorEl.appendChild(empty);
      return;
    }
    shown.forEach(function (row) { editorEl.appendChild(renderSection(row.sec, row.si)); });
  }

  function rewardDialog(initial, onSave) {
    var rw;
    openModal(initial && initial.item ? t("reward.edit") : t("reward.new"), function (body) {
      rw = rewardField(initial);
      body.appendChild(rw.el);
    }, function () { onSave(rw.value()); });
  }

  function rewardsEditor(rewards, onChange) {
    var wrap = document.createElement("div");
    wrap.className = "rewards";
    var list = document.createElement("div");
    list.className = "rewards__list";
    wrap.appendChild(list);

    var add = document.createElement("button");
    add.type = "button"; add.className = "reward reward_add"; add.textContent = t("reward.add");
    add.title = t("reward.addTitle");
    add.addEventListener("click", function () {
      rewardDialog(null, function (v) { if (v) { rewards.push(v); refresh(); } });
    });
    add.addEventListener("dragover", function (e) { if (!drag) return; e.preventDefault(); e.stopPropagation(); add.classList.add("over"); });
    add.addEventListener("dragleave", function () { add.classList.remove("over"); });
    add.addEventListener("drop", function (e) {
      e.preventDefault(); e.stopPropagation(); add.classList.remove("over");
      if (!drag) return;
      rewards.push({ item: drag.item, count: 1 }); refresh();
    });
    wrap.appendChild(add);

    function refresh() { paint(); onChange(); }

    function paint() {
      list.innerHTML = "";
      rewards.forEach(function (r, i) {
        var box = document.createElement("div");
        box.className = "reward";
        box.title = t("reward.placeholderTitle");
        box.appendChild(makeIconById(r.item, 20));
        var label = document.createElement("span"); label.className = "reward__text"; label.textContent = itemName(r.item); box.appendChild(label);
        var c = document.createElement("span"); c.className = "reward__count"; c.textContent = "×" + (r.count || 1); box.appendChild(c);

        var del = document.createElement("button");
        del.className = "reward__del"; del.textContent = "×"; del.title = t("reward.remove");
        del.addEventListener("click", function (e) { e.stopPropagation(); rewards.splice(i, 1); refresh(); });
        box.appendChild(del);

        box.addEventListener("click", function () {
          rewardDialog(r, function (v) { if (v) rewards[i] = v; refresh(); });
        });
        box.addEventListener("dragover", function (e) { if (!drag) return; e.preventDefault(); e.stopPropagation(); box.classList.add("over"); });
        box.addEventListener("dragleave", function () { box.classList.remove("over"); });
        box.addEventListener("drop", function (e) {
          e.preventDefault(); e.stopPropagation(); box.classList.remove("over");
          if (!drag) return;
          rewards[i] = { item: drag.item, count: r.count || 1 }; refresh();
        });
        list.appendChild(box);
      });
    }
    paint();
    return wrap;
  }

  function neighborSameType(si, dir) {
    var isEvent = !!config.sections[si].event;
    for (var j = si + dir; j >= 0 && j < config.sections.length; j += dir) {
      if (isTitleSection(config.sections[j])) continue;
      if (!!config.sections[j].event === isEvent) return j;
    }
    return -1;
  }
  function moveSection(si, dir) {
    var j = neighborSameType(si, dir);
    if (j < 0) return;
    var t = config.sections[si]; config.sections[si] = config.sections[j]; config.sections[j] = t;
    render();
  }
  function moveCategory(si, ci, dir) {
    var cats = config.sections[si].categories;
    var j = ci + dir;
    if (j < 0 || j >= cats.length) return;
    var t = cats[ci]; cats[ci] = cats[j]; cats[j] = t;
    render();
  }

  function arrowBar(onUp, onDown, upDisabled, downDisabled) {
    var wrap = document.createElement("div");
    wrap.className = "arrowbar";
    var up = document.createElement("button");
    up.className = "arrow"; up.textContent = "▲"; up.title = t("arrow.up"); up.disabled = upDisabled;
    up.addEventListener("click", onUp);
    var dn = document.createElement("button");
    dn.className = "arrow"; dn.textContent = "▼"; dn.title = t("arrow.down"); dn.disabled = downDisabled;
    dn.addEventListener("click", onDown);
    wrap.appendChild(up); wrap.appendChild(dn);
    return wrap;
  }

  function renderSection(sec, si) {
    var root = document.createElement("div");
    root.className = "section";

    var head = document.createElement("div");
    head.className = "section__head";

    var badge = document.createElement("span"); badge.className = "section__badge"; badge.textContent = sec.event ? t("badge.event") : t("badge.section");
    head.appendChild(badge);

    head.appendChild(arrowBar(
      function () { moveSection(si, -1); },
      function () { moveSection(si, 1); },
      neighborSameType(si, -1) < 0, neighborSameType(si, 1) < 0
    ));

    var nameInput = document.createElement("input");
    nameInput.className = "titleInput"; nameInput.value = sec.name; nameInput.placeholder = t("field.sectionName");
    nameInput.addEventListener("input", function () { sec.name = nameInput.value; autosave(); });
    head.appendChild(nameInput);

    var crumbs = document.createElement("span"); crumbs.className = "crumbs"; crumbs.textContent = "id: " + sec.id;
    head.appendChild(crumbs);

    head.appendChild(rewardsEditor(sec.rewards, autosave));

    var actions = document.createElement("div"); actions.className = "head__actions";

    var addC = document.createElement("button");
    addC.className = "btn btn_small"; addC.textContent = t("btn.addCategory");
    addC.addEventListener("click", function () {
      var ids = sec.categories.map(function (c) { return c.id; });
      sec.categories.push(ensureCategory({ id: uid("category", ids), name: t("default.category") }));
      render();
    });
    actions.appendChild(addC);

    var gear = document.createElement("button");
    gear.className = "btn btn_small"; gear.textContent = "⚙"; gear.title = t("section.settings");
    gear.addEventListener("click", function () { editSection(si); });
    actions.appendChild(gear);

    var del = document.createElement("button");
    del.className = "btn btn_small btn_danger"; del.textContent = "✕"; del.title = t("section.delete");
    del.addEventListener("click", function () {
      if (confirm(t("confirm.deleteSection", { name: sec.name }))) { config.sections.splice(si, 1); render(); }
    });
    actions.appendChild(del);

    head.appendChild(actions);
    root.appendChild(head);

    var cats = document.createElement("div"); cats.className = "categories";
    if (!sec.categories.length) {
      var e = document.createElement("div"); e.className = "hint"; e.textContent = t("category.none");
      cats.appendChild(e);
    }
    sec.categories.forEach(function (cat, ci) { cats.appendChild(renderCategory(sec, si, cat, ci)); });
    root.appendChild(cats);
    return root;
  }

  function renderCategory(sec, si, cat, ci) {
    var root = document.createElement("div"); root.className = "category";

    var head = document.createElement("div"); head.className = "category__head";

    var badge = document.createElement("span"); badge.className = "section__badge cat__badge"; badge.textContent = t("badge.category");
    head.appendChild(badge);

    head.appendChild(arrowBar(
      function () { moveCategory(si, ci, -1); },
      function () { moveCategory(si, ci, 1); },
      ci === 0, ci === sec.categories.length - 1
    ));

    var nameInput = document.createElement("input");
    nameInput.className = "titleInput"; nameInput.value = cat.name; nameInput.placeholder = t("field.categoryName");
    nameInput.addEventListener("input", function () { cat.name = nameInput.value; autosave(); });
    head.appendChild(nameInput);

    var crumbs = document.createElement("span"); crumbs.className = "crumbs"; crumbs.textContent = "id: " + cat.id;
    head.appendChild(crumbs);

    head.appendChild(rewardsEditor(cat.rewards, autosave));

    var actions = document.createElement("div"); actions.className = "head__actions";
    var gear = document.createElement("button");
    gear.className = "btn btn_small"; gear.textContent = "⚙"; gear.title = t("category.settings");
    gear.addEventListener("click", function () { editCategory(si, ci); });
    actions.appendChild(gear);
    var del = document.createElement("button");
    del.className = "btn btn_small btn_danger"; del.textContent = "✕"; del.title = t("category.delete");
    del.addEventListener("click", function () {
      if (confirm(t("confirm.deleteCategory", { name: cat.name }))) { sec.categories.splice(ci, 1); render(); }
    });
    actions.appendChild(del);
    head.appendChild(actions);
    root.appendChild(head);

    var grid = document.createElement("div");
    grid.className = "items"; grid.dataset.si = si; grid.dataset.ci = ci;

    if (!cat.items.length) {
      var e = document.createElement("div"); e.className = "items__empty"; e.textContent = t("items.dropHere");
      grid.appendChild(e);
    }

    cat.items.forEach(function (itemId, idx) {
      var chip = document.createElement("div");
      chip.className = "chip"; chip.draggable = true; chip.dataset.idx = idx; chip.dataset.id = itemId;
      chip.appendChild(makeIconById(itemId, 40));

      var tip = document.createElement("div"); tip.className = "chip__name";
      tip.innerHTML = esc(itemName(itemId)) + "<br><small>" + esc(itemId) + "</small>";
      chip.appendChild(tip);

      var d = document.createElement("button");
      d.className = "chip__del"; d.textContent = "×"; d.title = t("items.remove");
      d.addEventListener("click", function (ev) { ev.stopPropagation(); cat.items.splice(idx, 1); render(); });
      chip.appendChild(d);

      chip.addEventListener("dragstart", function (ev) { startMoveDrag(ev, si, ci, idx, itemId); chip.classList.add("dragging"); });
      chip.addEventListener("dragend", function () { chip.classList.remove("dragging"); endDrag(); });

      grid.appendChild(chip);
    });

    grid.addEventListener("dragover", function (e) {
      if (!drag) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = drag.kind === "new" ? "copy" : "move";
      grid.classList.add("over");
    });
    grid.addEventListener("dragleave", function (e) {
      if (!grid.contains(e.relatedTarget)) grid.classList.remove("over");
    });
    grid.addEventListener("drop", function (e) {
      e.preventDefault();
      grid.classList.remove("over");
      if (!drag) return;
      handleDrop(si, ci, computeIndex(grid, e.clientX, e.clientY));
    });

    root.appendChild(grid);
    return root;
  }

  function computeIndex(grid, x, y) {
    var chips = $$(".chip", grid);
    if (!chips.length) return 0;
    var rects = chips.map(function (c) { return c.getBoundingClientRect(); });
    var rows = [];
    rects.forEach(function (r, i) {
      var row = rows[rows.length - 1];
      if (row && Math.abs(r.top - row.top) < r.height * 0.5) {
        row.indices.push(i); row.bottom = Math.max(row.bottom, r.bottom); row.top = Math.min(row.top, r.top);
      } else {
        rows.push({ top: r.top, bottom: r.bottom, indices: [i] });
      }
    });
    var target = rows[0], best = Infinity;
    rows.forEach(function (rw) {
      var mid = (rw.top + rw.bottom) / 2, d = Math.abs(y - mid);
      if (d < best) { best = d; target = rw; }
    });
    var ins = target.indices[target.indices.length - 1] + 1;
    for (var k = 0; k < target.indices.length; k++) {
      var idx = target.indices[k], r = rects[idx];
      if (x < r.left + r.width / 2) { ins = idx; break; }
    }
    return ins;
  }

  function handleDrop(si, ci, index) {
    var list = config.sections[si].categories[ci].items;
    if (drag.kind === "new") {
      if (list.indexOf(drag.item) !== -1) { toast(t("toast.duplicate"), true); return; }
      list.splice(index, 0, drag.item);
    } else if (drag.kind === "move") {
      var srcList = config.sections[drag.si].categories[drag.ci].items;
      var same = (drag.si === si && drag.ci === ci);
      var item = srcList.splice(drag.idx, 1)[0];
      if (same && index > drag.idx) index--;
      list.splice(index, 0, item);
    }
    render();
  }

  /* ---------- modals ---------- */
  var modal = $("#modal"), modalTitle = $("#modalTitle"), modalBody = $("#modalBody"), modalOk = $("#modalOk");
  var modalOkFn = null;
  function openModal(title, builder, onOk) {
    modalTitle.textContent = title; modalBody.innerHTML = ""; builder(modalBody); modalOkFn = onOk; modal.hidden = false;
  }
  function closeModal() { modal.hidden = true; modalOkFn = null; }
  modalOk.addEventListener("click", function () { if (!modalOkFn || modalOkFn() !== false) closeModal(); });
  $$("[data-close]").forEach(function (el) { el.addEventListener("click", closeModal); });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && !modal.hidden) closeModal();
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") { e.preventDefault(); saveConfig(); }
  });

  function field(label, inputEl, hint) {
    var f = document.createElement("div"); f.className = "field";
    var l = document.createElement("label"); l.textContent = label; f.appendChild(l); f.appendChild(inputEl);
    if (hint) { var h = document.createElement("div"); h.className = "hint"; h.textContent = hint; f.appendChild(h); }
    return f;
  }
  function textInput(value, placeholder, listId) {
    var i = document.createElement("input"); i.className = "input"; i.value = value || "";
    if (placeholder) i.placeholder = placeholder;
    if (listId) i.setAttribute("list", listId);
    return i;
  }
  function checkboxField(label, checked, hint) {
    var wrap = document.createElement("label"); wrap.className = "check";
    var cb = document.createElement("input"); cb.type = "checkbox"; cb.checked = !!checked;
    var span = document.createElement("span"); span.textContent = label;
    wrap.appendChild(cb); wrap.appendChild(span);
    var box = document.createElement("div"); box.className = "field";
    box.appendChild(wrap);
    if (hint) { var h = document.createElement("div"); h.className = "hint"; h.textContent = hint; box.appendChild(h); }
    return { el: box, input: cb };
  }

  var MC_LOCALES = [
    { code: "en_us", label: "English (US)" },
    { code: "ru_ru", label: "Русский" },
    { code: "de_de", label: "Deutsch" },
    { code: "fr_fr", label: "Français" },
    { code: "es_es", label: "Español (España)" },
    { code: "es_mx", label: "Español (México)" },
    { code: "pt_br", label: "Português (Brasil)" },
    { code: "pt_pt", label: "Português (Portugal)" },
    { code: "it_it", label: "Italiano" },
    { code: "ja_jp", label: "日本語" },
    { code: "ko_kr", label: "한국어" },
    { code: "zh_cn", label: "简体中文" },
    { code: "zh_tw", label: "繁體中文" },
    { code: "pl_pl", label: "Polski" },
    { code: "tr_tr", label: "Türkçe" },
    { code: "uk_ua", label: "Українська" },
    { code: "nl_nl", label: "Nederlands" },
    { code: "sv_se", label: "Svenska" },
    { code: "cs_cz", label: "Čeština" },
    { code: "hu_hu", label: "Magyar" }
  ];
  function isKnownLocale(code) {
    return MC_LOCALES.some(function (o) { return o.code === code; });
  }
  function localeOptions() {
    return MC_LOCALES.slice();
  }

  function namesEditor(initial) {
    var rows = [];
    if (initial && typeof initial === "object") {
      Object.keys(initial).forEach(function (k) {
        if (typeof initial[k] === "string") rows.push({ loc: k, val: initial[k], custom: !!k && !isKnownLocale(k) });
      });
    }
    var wrap = document.createElement("div"); wrap.className = "names";
    var list = document.createElement("div"); list.className = "names__list";
    var add = document.createElement("button");
    add.type = "button"; add.className = "btn btn_small"; add.textContent = t("names.add");
    wrap.appendChild(list); wrap.appendChild(add);

    function paint() {
      list.innerHTML = "";
      rows.forEach(function (row, i) {
        var r = document.createElement("div"); r.className = "names__row";
        var used = {};
        rows.forEach(function (x, j) { if (j !== i && x.loc) used[x.loc] = true; });
        var opts = localeOptions();
        if (row.custom && row.loc && !isKnownLocale(row.loc)) opts.push({ code: row.loc, label: row.loc });
        if (!row.custom && !row.loc) {
          var first = opts.filter(function (o) { return !used[o.code]; })[0] || opts[0];
          row.loc = first.code;
        }
        var loc = document.createElement("select");
        loc.className = "input names__loc";
        opts.forEach(function (o) {
          var opt = document.createElement("option");
          opt.value = o.code;
          opt.textContent = o.label + " (" + o.code + ")";
          opt.disabled = !!used[o.code];
          loc.appendChild(opt);
        });
        var customOpt = document.createElement("option");
        customOpt.value = "__custom__"; customOpt.textContent = t("names.custom");
        loc.appendChild(customOpt);
        loc.value = row.custom ? "__custom__" : row.loc;
        loc.addEventListener("change", function () {
          if (loc.value === "__custom__") { row.custom = true; row.loc = ""; }
          else { row.custom = false; row.loc = loc.value; }
          paint();
        });
        r.appendChild(loc);

        if (row.custom) {
          var code = document.createElement("input");
          code.className = "input names__code"; code.value = row.loc; code.placeholder = "xx_xx";
          code.addEventListener("input", function () { row.loc = code.value; });
          r.appendChild(code);
        }

        var val = document.createElement("input");
        val.className = "input"; val.value = row.val; val.placeholder = t("names.translation");
        val.addEventListener("input", function () { row.val = val.value; });
        var del = document.createElement("button");
        del.type = "button"; del.className = "btn btn_small btn_danger"; del.textContent = "×"; del.title = t("names.remove");
        del.addEventListener("click", function () { rows.splice(i, 1); paint(); });
        r.appendChild(val); r.appendChild(del);
        list.appendChild(r);
      });
    }
    add.addEventListener("click", function () { rows.push({ loc: "", val: "", custom: false }); paint(); });
    paint();
    return {
      el: wrap,
      value: function () {
        var out = {};
        rows.forEach(function (r) {
          var key = String(r.loc || "").trim();
          if (key) out[key] = r.val;
        });
        return out;
      }
    };
  }

  function rewardField(initial) {
    var state = { item: (initial && initial.item) || "", count: (initial && initial.count) || 1 };
    var wrap = document.createElement("div"); wrap.className = "field";
    var l = document.createElement("label"); l.textContent = t("reward.field"); wrap.appendChild(l);
    var row = document.createElement("div"); row.className = "row";
    var preview = document.createElement("div"); preview.className = "reward"; preview.style.minWidth = "160px";
    var itemInput = textInput(state.item, "minecraft:diamond", "itemIdList"); itemInput.style.flex = "2";
    function paint() {
      preview.innerHTML = "";
      if (state.item) {
        var ic = document.createElement("div"); ic.className = "reward__icon"; ic.appendChild(makeIconById(state.item, 20)); preview.appendChild(ic);
        var label = document.createElement("span"); label.className = "reward__text"; label.textContent = itemName(state.item); preview.appendChild(label);
      } else preview.appendChild(document.createTextNode(t("reward.drag")));
    }
    paint();
    preview.addEventListener("dragover", function (e) { if (!drag) return; e.preventDefault(); e.stopPropagation(); preview.classList.add("over"); });
    preview.addEventListener("dragleave", function () { preview.classList.remove("over"); });
    preview.addEventListener("drop", function (e) {
      e.preventDefault(); e.stopPropagation(); preview.classList.remove("over");
      if (!drag) return; state.item = drag.item; itemInput.value = drag.item; paint();
    });
    itemInput.addEventListener("input", function () { state.item = itemInput.value.trim(); paint(); });
    var countInput = document.createElement("input");
    countInput.className = "input"; countInput.type = "number"; countInput.min = "1"; countInput.value = state.count; countInput.style.flex = "0 0 80px";
    countInput.addEventListener("input", function () { state.count = Math.max(1, parseInt(countInput.value, 10) || 1); });
    row.appendChild(preview); row.appendChild(itemInput); row.appendChild(countInput); wrap.appendChild(row);
    return { el: wrap, value: function () { return state.item ? { item: state.item, count: state.count || 1 } : null; } };
  }

  function editSection(si) {
    var sec = config.sections[si];
    var idIn, nameIn, namesEd, iconIn, goldIn, actIn, inactIn, eventCb;
    openModal(t("section.settings"), function (body) {
      idIn = textInput(sec.id, "main");
      nameIn = textInput(sec.name, t("field.nameHint"));
      namesEd = namesEditor(sec.names);
      iconIn = textInput(sec.icon, "icon_bookmark_main", "iconList");
      goldIn = textInput(sec.gold_icon, "gold_icon_bookmark_main", "iconList");
      actIn = textInput(sec.tab_active, "bookmark_active_left");
      inactIn = textInput(sec.tab_inactive, "bookmark_inactive_left");
      var ev = checkboxField(t("field.event"), sec.event, t("field.eventHint"));
      eventCb = ev.input;
      body.appendChild(field(t("field.idSection"), idIn));
      body.appendChild(field(t("field.name"), nameIn));
      body.appendChild(field(t("field.localization"), namesEd.el, t("field.localizationHint")));
      body.appendChild(field(t("field.icon"), iconIn));
      body.appendChild(field(t("field.goldIcon"), goldIn));
      body.appendChild(ev.el);
      body.appendChild(field(t("field.tabActive"), actIn, t("field.tabDefault")));
      body.appendChild(field(t("field.tabInactive"), inactIn, t("field.tabDefault")));
    }, function () {
      var newId = idIn.value.trim();
      if (!newId) { toast(t("toast.idEmpty"), true); return false; }
      if (config.sections.some(function (s, i) { return i !== si && s.id === newId; })) { toast(t("toast.sectionIdExists"), true); return false; }
      sec.id = newId; sec.name = nameIn.value; sec.names = ensureNames(namesEd.value());
      sec.icon = iconIn.value; sec.gold_icon = goldIn.value;
      sec.tab_active = actIn.value.trim(); sec.tab_inactive = inactIn.value.trim();
      sec.event = eventCb.checked;
      if (sec.event) editTab = "event"; else editTab = "normal";
      render();
    });
  }
  function editCategory(si, ci) {
    var cat = config.sections[si].categories[ci];
    var idIn, nameIn, namesEd, iconIn, goldIn;
    openModal(t("category.settings"), function (body) {
      idIn = textInput(cat.id, "plants");
      nameIn = textInput(cat.name, t("field.nameHint"));
      namesEd = namesEditor(cat.names);
      iconIn = textInput(cat.icon, "icon_category_plants", "iconList");
      goldIn = textInput(cat.gold_icon, "gold_icon_category_plants", "iconList");
      body.appendChild(field(t("field.idCategory"), idIn));
      body.appendChild(field(t("field.name"), nameIn));
      body.appendChild(field(t("field.localization"), namesEd.el, t("field.localizationHint")));
      body.appendChild(field(t("field.icon"), iconIn));
      body.appendChild(field(t("field.goldIcon"), goldIn));
    }, function () {
      var newId = idIn.value.trim();
      if (!newId) { toast(t("toast.idEmpty"), true); return false; }
      if (config.sections[si].categories.some(function (c, i) { return i !== ci && c.id === newId; })) { toast(t("toast.categoryIdExists"), true); return false; }
      cat.id = newId; cat.name = nameIn.value; cat.names = ensureNames(namesEd.value());
      cat.icon = iconIn.value; cat.gold_icon = goldIn.value;
      render();
    });
  }

  /* ---------- toast ---------- */
  var toasts = $("#toasts");
  function toast(msg, isErr) {
    var el = document.createElement("div");
    el.className = "toast" + (isErr ? " err" : "");
    el.textContent = msg;
    toasts.appendChild(el);
    setTimeout(function () {
      el.style.transition = ".3s"; el.style.opacity = "0"; el.style.transform = "translateX(30px)";
      setTimeout(function () { el.remove(); }, 320);
    }, 2400);
    return el;
  }

  /* ---------- save / load ---------- */
  function cleanRewards(list) {
    var out = (list || []).map(function (r) {
      return (!r || !r.item) ? null : { item: r.item, count: r.count || 1 };
    }).filter(Boolean);
    return out.length ? out : undefined;
  }
  function cleanNames(n) {
    var out = {};
    if (n && typeof n === "object") {
      Object.keys(n).forEach(function (k) {
        var key = String(k).trim();
        if (key) out[key] = n[k];
      });
    }
    return Object.keys(out).length ? out : undefined;
  }
  function serialize() {
    return {
      sections: config.sections.map(function (s) {
        var sec = { id: s.id, name: s.name };
        var nm = cleanNames(s.names); if (nm) sec.names = nm;
        sec.icon = s.icon || "";
        if (s.gold_icon) sec.gold_icon = s.gold_icon;
        if (s.event) sec.event = true;
        if (s.tab_active) sec.tab_active = s.tab_active;
        if (s.tab_inactive) sec.tab_inactive = s.tab_inactive;
        var r = cleanRewards(s.rewards); if (r) sec.rewards = r;
        sec.categories = s.categories.map(function (c) {
          var cat = { id: c.id, name: c.name };
          var cnm = cleanNames(c.names); if (cnm) cat.names = cnm;
          cat.icon = c.icon || ""; cat.items = c.items.slice();
          if (c.gold_icon) cat.gold_icon = c.gold_icon;
          var cr = cleanRewards(c.rewards); if (cr) cat.rewards = cr;
          return cat;
        });
        return sec;
      })
    };
  }
  function saveConfig() {
    var data = JSON.stringify(serialize(), null, 2);
    var blob = new Blob([data], { type: "application/json" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = "collectionsbook.json";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
    toast(t("toast.configSaved"));
  }
  function stripJsonComments(text) {
    var out = "", instr = false, esc = false;
    for (var i = 0; i < text.length; i++) {
      var c = text[i];
      if (instr) {
        out += c;
        if (esc) esc = false;
        else if (c === "\\") esc = true;
        else if (c === '"') instr = false;
        continue;
      }
      if (c === '"') { instr = true; out += c; continue; }
      if (c === "/" && text[i + 1] === "/") { while (i < text.length && text[i] !== "\n") i++; continue; }
      out += c;
    }
    return out;
  }
  function parseConfigText(text) {
    var clean = stripJsonComments(text).replace(/,\s*([}\]])/g, "$1");
    return normalize(JSON.parse(clean));
  }
  function loadConfigText(text) {
    try { config = parseConfigText(text); render(); toast(t("toast.configLoaded")); }
    catch (e) { toast(t("toast.jsonError", { msg: e.message }), true); }
  }
  function autosave() { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(serialize())); } catch (e) {} }

  /* ---------- init ---------- */
  function syncLangUi() {
    var sel = $("#langSelect");
    if (sel) sel.value = window.I18N.getLang();
  }
  function syncThemeUi() {
    var btn = $("#themeToggle");
    if (btn) btn.setAttribute("aria-pressed", window.I18N.getTheme() === "light" ? "true" : "false");
  }
  function init() {
    window.I18N.applyDOM(document);
    syncLangUi();
    syncThemeUi();
    var langSel = $("#langSelect");
    if (langSel) langSel.addEventListener("change", function () {
      window.I18N.setLang(langSel.value);
    });
    var themeBtn = $("#themeToggle");
    if (themeBtn) themeBtn.addEventListener("click", function () {
      window.I18N.setTheme(window.I18N.getTheme() === "light" ? "dark" : "light");
    });
    document.addEventListener("i18n:change", function () {
      rebuildTabs();
      rebuildCatFilter();
      rebuildDatalist();
      buildPalette();
      applyFilter();
      render();
    });

    buildEntries();
    rebuildTabs();
    rebuildCatFilter();
    buildPalette();
    rebuildDatalist();
    applyFilter();
    updateItemTotal();

    searchEl.addEventListener("input", applyFilter);
    catFilter.addEventListener("change", applyFilter);

    $("#btnAddSection").addEventListener("click", function () {
      var ids = config.sections.map(function (s) { return s.id; });
      var isEvent = editTab === "event";
      config.sections.push(ensureSection({
        id: uid("section", ids),
        name: isEvent ? t("default.eventSection") : t("default.section"),
        icon: isEvent ? "icon_bookmark_halloween" : "icon_bookmark_main",
        event: isEvent
      }));
      render();
    });
    $("#btnSave").addEventListener("click", saveConfig);
    $("#btnNew").addEventListener("click", function () {
      if (confirm(t("confirm.newConfig"))) { config = { sections: [] }; render(); }
    });
    $("#btnExample").addEventListener("click", function () {
      if (window.EXAMPLE_CONFIG) { config = normalize(clone(window.EXAMPLE_CONFIG)); render(); toast(t("toast.exampleLoaded")); }
    });
    $("#btnLoad").addEventListener("click", function () { $("#fileInput").click(); });
    $("#fileInput").addEventListener("change", function (e) {
      var file = e.target.files[0]; if (!file) return;
      var reader = new FileReader();
      reader.onload = function () { loadConfigText(reader.result); };
      reader.readAsText(file); e.target.value = "";
    });

    $("#btnLoadMod").addEventListener("click", function () { $("#modInput").click(); });
    $("#modInput").addEventListener("change", function (e) {
      var file = e.target.files[0]; if (!file) return;
      loadModFile(file); e.target.value = "";
    });

    trash.addEventListener("dragover", function (e) { if (drag && drag.kind === "move") e.preventDefault(); });
    trash.addEventListener("drop", function (e) {
      e.preventDefault();
      if (drag && drag.kind === "move") {
        config.sections[drag.si].categories[drag.ci].items.splice(drag.idx, 1);
        endDrag(); render();
      }
    });

    document.addEventListener("dragover", function (e) { if (drag) e.preventDefault(); });
    document.addEventListener("drop", function (e) { if (drag) { e.preventDefault(); endDrag(); } });

    initTouchDnD();

    var stored = null;
    try { stored = localStorage.getItem(STORAGE_KEY); } catch (e) {}
    if (stored) { try { config = parseConfigText(stored); } catch (e) { config = null; } }
    if (!config) config = normalize(window.EXAMPLE_CONFIG ? clone(window.EXAMPLE_CONFIG) : { sections: [] });

    reloadMods().catch(function () {}).then(function () { render(); });
  }

  document.addEventListener("DOMContentLoaded", init);
})();
