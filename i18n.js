(function () {
  "use strict";

  var DICT = {
    ru: {
      "app.title": "Конструктор Collector's Book",
      "units.items": "блоков и предметов",

      "btn.example": "Пример",
      "btn.new": "Новый",
      "btn.load": "Загрузить",
      "btn.save": "Сохранить конфиг",
      "btn.loadMod": "+ Загрузить мод",
      "btn.addSection": "+ Раздел",
      "btn.addCategory": "+ Категория",

      "panel.palette": "Блоки и предметы",
      "panel.config": "Конфигурация",
      "search.placeholder": "Поиск по названию или ID…",
      "palette.hint": "Перетащите предмет в категорию справа →",
      "palette.none": "Ничего не найдено",

      "trash.drop": "Отпустите, чтобы удалить",
      "modal.cancel": "Отмена",
      "modal.ok": "Готово",

      "tab.all": "Все",
      "tab.vanilla": "Vanilla",
      "tab.unloadMod": "Выгрузить мод",

      "filter.all": "Все",
      "filter.allSources": "Все источники",
      "filter.allCategories": "Все категории",
      "filter.items": "Предметы",
      "filter.blocks": "Блоки",

      "editor.normal": "Обычные",
      "editor.event": "Ивентовые",
      "editor.normalTitle": "Обычные разделы (закладка слева)",
      "editor.eventTitle": "Ивентовые разделы (закладка справа)",
      "editor.noEvent": "Нет ивентовых разделов",
      "editor.noConfig": "Пустой конфиг",
      "editor.noEventHint": "Нажмите «+ Раздел», чтобы создать ивентовый раздел.",
      "editor.noConfigHint": "Нажмите «+ Раздел», чтобы создать первый раздел, затем перетаскивайте предметы из панели слева.",

      "badge.section": "РАЗДЕЛ",
      "badge.event": "ИВЕНТ",
      "badge.category": "КАТЕГОРИЯ",

      "field.sectionName": "Название раздела",
      "field.categoryName": "Название категории",
      "field.name": "Название",
      "field.nameHint": "Название",
      "field.localization": "Локализация",
      "field.localizationHint": "Язык → перевод.",
      "field.idSection": "ID (уникальный)",
      "field.idCategory": "ID (уникальный в разделе)",
      "field.icon": "Иконка",
      "field.goldIcon": "Золотая иконка",
      "field.tabActive": "Спрайт активной закладки",
      "field.tabInactive": "Спрайт неактивной закладки",
      "field.tabDefault": "Пусто — значение по умолчанию",
      "field.event": "Ивентовый раздел (закладка справа)",
      "field.eventHint": "Обычные и ивентовые разделы редактируются во вкладках.",

      "category.none": "В разделе пока нет категорий.",
      "items.dropHere": "Перетащите предметы сюда",
      "items.remove": "Убрать предмет",
      "section.settings": "Настройки раздела",
      "category.settings": "Настройки категории",
      "section.delete": "Удалить раздел",
      "category.delete": "Удалить категорию",

      "confirm.deleteSection": "Удалить раздел «{name}»?",
      "confirm.deleteCategory": "Удалить категорию «{name}»?",
      "confirm.unloadMod": "Выгрузить мод «{name}»? Предметы исчезнут из палитры.",
      "confirm.newConfig": "Создать новый пустой конфиг? Несохранённые изменения будут потеряны.",

      "reward.new": "Новая награда",
      "reward.edit": "Изменить награду",
      "reward.placeholderTitle": "Награда — нажмите, чтобы изменить, или перетащите предмет",
      "reward.remove": "Убрать награду",
      "reward.add": "+ награда",
      "reward.addTitle": "Добавить награду (или перетащите предмет)",
      "reward.field": "Награда (предмет и количество)",
      "reward.drag": "Перетащите предмет",

      "arrow.up": "Вверх",
      "arrow.down": "Вниз",

      "names.add": "+ язык",
      "names.custom": "Свой код…",
      "names.translation": "Перевод",
      "names.remove": "Убрать локализацию",

      "default.section": "Новый раздел",
      "default.eventSection": "Новый ивентовый раздел",
      "default.category": "Новая категория",

      "toast.modNotFound": "Модуль загрузки модов не найден",
      "toast.readingMod": "Читаю мод: {name}…",
      "toast.modNoItems": "В моде не найдено предметов/блоков",
      "toast.modLoaded": "Мод загружен: {name} ({count})",
      "toast.modLoadError": "Ошибка загрузки мода: {msg}",
      "toast.modUnloaded": "Мод выгружен: {name}",
      "toast.duplicate": "Этот предмет уже добавлен в категорию",
      "toast.idEmpty": "ID не может быть пустым",
      "toast.sectionIdExists": "Раздел с таким ID уже существует",
      "toast.categoryIdExists": "Категория с таким ID уже существует",
      "toast.configSaved": "Конфиг сохранён",
      "toast.configLoaded": "Конфиг загружен",
      "toast.jsonError": "Ошибка чтения JSON: {msg}",
      "toast.exampleLoaded": "Пример загружен",

      "ui.language": "Язык",
      "ui.theme": "Тема",
      "theme.dark": "Тёмная",
      "theme.light": "Светлая",
      "theme.toggle": "Переключить тему"
    },
    en: {
      "app.title": "Collector's Book Builder",
      "units.items": "blocks and items",

      "btn.example": "Example",
      "btn.new": "New",
      "btn.load": "Load",
      "btn.save": "Save config",
      "btn.loadMod": "+ Load mod",
      "btn.addSection": "+ Section",
      "btn.addCategory": "+ Category",

      "panel.palette": "Blocks and items",
      "panel.config": "Configuration",
      "search.placeholder": "Search by name or ID…",
      "palette.hint": "Drag an item into a category on the right →",
      "palette.none": "Nothing found",

      "trash.drop": "Drop to delete",
      "modal.cancel": "Cancel",
      "modal.ok": "Done",

      "tab.all": "All",
      "tab.vanilla": "Vanilla",
      "tab.unloadMod": "Unload mod",

      "filter.all": "All",
      "filter.allSources": "All sources",
      "filter.allCategories": "All categories",
      "filter.items": "Items",
      "filter.blocks": "Blocks",

      "editor.normal": "Normal",
      "editor.event": "Event",
      "editor.normalTitle": "Normal sections (left tab)",
      "editor.eventTitle": "Event sections (right tab)",
      "editor.noEvent": "No event sections",
      "editor.noConfig": "Empty config",
      "editor.noEventHint": "Click “+ Section” to create an event section.",
      "editor.noConfigHint": "Click “+ Section” to create the first section, then drag items from the panel on the left.",

      "badge.section": "SECTION",
      "badge.event": "EVENT",
      "badge.category": "CATEGORY",

      "field.sectionName": "Section name",
      "field.categoryName": "Category name",
      "field.name": "Name",
      "field.nameHint": "Name",
      "field.localization": "Localization",
      "field.localizationHint": "Language → translation.",
      "field.idSection": "ID (unique)",
      "field.idCategory": "ID (unique within section)",
      "field.icon": "Icon",
      "field.goldIcon": "Gold icon",
      "field.tabActive": "Active tab sprite",
      "field.tabInactive": "Inactive tab sprite",
      "field.tabDefault": "Empty — default value",
      "field.event": "Event section (right tab)",
      "field.eventHint": "Normal and event sections are edited in separate tabs.",

      "category.none": "No categories in this section yet.",
      "items.dropHere": "Drag items here",
      "items.remove": "Remove item",
      "section.settings": "Section settings",
      "category.settings": "Category settings",
      "section.delete": "Delete section",
      "category.delete": "Delete category",

      "confirm.deleteSection": "Delete section “{name}”?",
      "confirm.deleteCategory": "Delete category “{name}”?",
      "confirm.unloadMod": "Unload mod “{name}”? Its items will disappear from the palette.",
      "confirm.newConfig": "Create a new empty config? Unsaved changes will be lost.",

      "reward.new": "New reward",
      "reward.edit": "Edit reward",
      "reward.placeholderTitle": "Reward — click to edit, or drag an item",
      "reward.remove": "Remove reward",
      "reward.add": "+ reward",
      "reward.addTitle": "Add reward (or drag an item)",
      "reward.field": "Reward (item and count)",
      "reward.drag": "Drag an item",

      "arrow.up": "Up",
      "arrow.down": "Down",

      "names.add": "+ language",
      "names.custom": "Custom code…",
      "names.translation": "Translation",
      "names.remove": "Remove localization",

      "default.section": "New section",
      "default.eventSection": "New event section",
      "default.category": "New category",

      "toast.modNotFound": "Mod loading module not found",
      "toast.readingMod": "Reading mod: {name}…",
      "toast.modNoItems": "No items/blocks found in the mod",
      "toast.modLoaded": "Mod loaded: {name} ({count})",
      "toast.modLoadError": "Mod loading error: {msg}",
      "toast.modUnloaded": "Mod unloaded: {name}",
      "toast.duplicate": "This item is already added to the category",
      "toast.idEmpty": "ID cannot be empty",
      "toast.sectionIdExists": "A section with this ID already exists",
      "toast.categoryIdExists": "A category with this ID already exists",
      "toast.configSaved": "Config saved",
      "toast.configLoaded": "Config loaded",
      "toast.jsonError": "JSON read error: {msg}",
      "toast.exampleLoaded": "Example loaded",

      "ui.language": "Language",
      "ui.theme": "Theme",
      "theme.dark": "Dark",
      "theme.light": "Light",
      "theme.toggle": "Toggle theme"
    }
  };

  var LANG_KEY = "collectionsbook.lang";
  var THEME_KEY = "collectionsbook.theme";
  var lang = null;
  var theme = null;

  function read(key) { try { return localStorage.getItem(key); } catch (e) { return null; } }
  function write(key, val) { try { localStorage.setItem(key, val); } catch (e) {} }

  function detectLang() {
    var saved = read(LANG_KEY);
    if (saved && DICT[saved]) return saved;
    var n = (navigator.language || navigator.userLanguage || "ru").toLowerCase();
    return n.indexOf("ru") === 0 ? "ru" : "en";
  }
  function detectTheme() {
    var saved = read(THEME_KEY);
    if (saved === "dark" || saved === "light") return saved;
    return "dark";
  }

  function t(key, vars) {
    var d = DICT[lang] || DICT.ru;
    var s = d[key] != null ? d[key] : (DICT.ru[key] != null ? DICT.ru[key] : key);
    if (vars) {
      Object.keys(vars).forEach(function (k) {
        s = s.replace(new RegExp("\\{" + k + "\\}", "g"), vars[k]);
      });
    }
    return s;
  }

  function applyDOM(root) {
    var scope = root || document;
    Array.prototype.forEach.call(scope.querySelectorAll("[data-i18n]"), function (el) {
      el.textContent = t(el.getAttribute("data-i18n"));
    });
    Array.prototype.forEach.call(scope.querySelectorAll("[data-i18n-ph]"), function (el) {
      el.setAttribute("placeholder", t(el.getAttribute("data-i18n-ph")));
    });
    Array.prototype.forEach.call(scope.querySelectorAll("[data-i18n-title]"), function (el) {
      el.setAttribute("title", t(el.getAttribute("data-i18n-title")));
    });
    document.documentElement.lang = lang;
    document.title = t("app.title") + " — Minecraft 26.2";
  }

  function setTheme(next) {
    var nextTheme = next === "light" ? "light" : "dark";
    if (nextTheme === theme) return;
    var root = document.documentElement;
    root.classList.add("theme-instant");
    theme = nextTheme;
    root.setAttribute("data-theme", theme);
    write(THEME_KEY, theme);
    var btn = document.getElementById ? document.getElementById("themeToggle") : null;
    if (btn) btn.setAttribute("aria-pressed", theme === "light" ? "true" : "false");
    void root.offsetHeight;
    requestAnimationFrame(function () { root.classList.remove("theme-instant"); });
    document.dispatchEvent(new CustomEvent("i18n:theme", { detail: theme }));
  }

  function setLang(next) {
    lang = DICT[next] ? next : "ru";
    write(LANG_KEY, lang);
    var sel = document.getElementById ? document.getElementById("langSelect") : null;
    if (sel) sel.value = lang;
    applyDOM(document);
    document.dispatchEvent(new CustomEvent("i18n:change", { detail: lang }));
  }

  window.I18N = {
    t: t,
    applyDOM: applyDOM,
    setLang: setLang,
    setTheme: setTheme,
    getLang: function () { return lang; },
    getTheme: function () { return theme; },
    locales: Object.keys(DICT)
  };

  lang = detectLang();
  theme = detectTheme();
  document.documentElement.setAttribute("data-theme", theme);
})();
