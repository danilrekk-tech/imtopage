/** Проверка доступности сгенерированной страницы: контраст, alt, семантика, клавиатура. */

export type A11ySeverity = "critical" | "warning" | "info";

export type A11yIssue = {
  id: string;
  severity: A11ySeverity;
  title: string;
  hint: string;
  count: number;
  samples: string[];
};

export type A11yReport = {
  score: number;
  total: number;
  issues: A11yIssue[];
};

export const A11Y_REQUEST = "__ip_a11y_request";
export const A11Y_RESULT = "__ip_a11y_result";

/** Скрипт аудита, исполняемый внутри iframe превью. */
export const A11Y_SCRIPT = `
<script id="__ip_a11y_js">
(function () {
  function label(el) {
    var tag = el.tagName.toLowerCase();
    var cls = (el.className && typeof el.className === "string" ? "." + el.className.trim().split(/\\s+/).slice(0, 2).join(".") : "");
    var text = (el.textContent || "").trim().slice(0, 40);
    return "<" + tag + cls + ">" + (text ? " «" + text + "»" : "");
  }
  function rgb(value) {
    var m = /rgba?\\(([^)]+)\\)/.exec(value || "");
    if (!m) return null;
    var p = m[1].split(",").map(function (n) { return parseFloat(n); });
    if (p.length > 3 && p[3] === 0) return null;
    return [p[0], p[1], p[2]];
  }
  function lum(c) {
    var a = c.map(function (v) {
      v = v / 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
  }
  function bgOf(el) {
    var node = el;
    while (node && node !== document.documentElement) {
      var c = rgb(getComputedStyle(node).backgroundColor);
      if (c) return c;
      node = node.parentElement;
    }
    return [255, 255, 255];
  }
  function ratio(a, b) {
    var l1 = lum(a), l2 = lum(b);
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  }

  function audit() {
    var issues = [];
    function push(id, severity, title, hint, nodes) {
      if (!nodes.length) return;
      issues.push({
        id: id, severity: severity, title: title, hint: hint,
        count: nodes.length,
        samples: nodes.slice(0, 4).map(label),
      });
    }

    // 1. Контраст текста
    var lowContrast = [];
    var texts = Array.prototype.slice.call(document.querySelectorAll("body *"));
    texts.forEach(function (el) {
      if (el.closest(".__ip_badge")) return;
      var direct = Array.prototype.filter.call(el.childNodes, function (n) {
        return n.nodeType === 3 && n.textContent.trim().length > 1;
      });
      if (!direct.length) return;
      var cs = getComputedStyle(el);
      if (cs.visibility === "hidden" || cs.display === "none" || parseFloat(cs.opacity) < 0.1) return;
      var fg = rgb(cs.color);
      if (!fg) return;
      var size = parseFloat(cs.fontSize) || 16;
      var bold = parseInt(cs.fontWeight, 10) >= 700;
      var need = size >= 24 || (bold && size >= 18.66) ? 3 : 4.5;
      if (ratio(fg, bgOf(el)) < need) lowContrast.push(el);
    });
    push("contrast", "critical", "Недостаточный контраст текста",
      "Контраст ниже нормы WCAG AA (4.5:1, для крупного текста 3:1). Затемните текст или осветлите фон.",
      lowContrast);

    // 2. Alt-тексты
    push("img-alt", "critical", "Изображения без alt",
      "Добавьте alt с описанием; для декоративных картинок используйте alt=\\"\\".",
      Array.prototype.filter.call(document.images, function (img) { return !img.hasAttribute("alt"); }));

    // 3. Доступное имя интерактивных элементов
    var noName = Array.prototype.filter.call(
      document.querySelectorAll("button, a[href], [role=button]"),
      function (el) {
        var t = (el.textContent || "").trim();
        return !t && !el.getAttribute("aria-label") && !el.getAttribute("aria-labelledby") && !el.getAttribute("title");
      });
    push("name", "critical", "Кнопки и ссылки без доступного имени",
      "Иконочным кнопкам нужен aria-label, иначе скринридер прочитает «кнопка».", noName);

    // 4. Поля форм без подписи
    var noLabel = Array.prototype.filter.call(
      document.querySelectorAll("input:not([type=hidden]), select, textarea"),
      function (el) {
        if (el.getAttribute("aria-label") || el.getAttribute("aria-labelledby")) return false;
        if (el.id && document.querySelector('label[for="' + el.id + '"]')) return false;
        return !el.closest("label");
      });
    push("labels", "critical", "Поля формы без подписи", "Свяжите label с полем через for/id или добавьте aria-label.", noLabel);

    // 5. Семантика: заголовки и лендмарки
    var headings = Array.prototype.slice.call(document.querySelectorAll("h1,h2,h3,h4,h5,h6"));
    var h1 = document.querySelectorAll("h1");
    if (h1.length !== 1) {
      issues.push({ id: "h1", severity: "warning", title: h1.length ? "На странице несколько h1" : "Нет заголовка h1",
        hint: "Ровно один h1 задаёт главную тему страницы.", count: h1.length || 1, samples: [] });
    }
    var skipped = [];
    var prev = 0;
    headings.forEach(function (h) {
      var lvl = parseInt(h.tagName[1], 10);
      if (prev && lvl > prev + 1) skipped.push(h);
      prev = lvl;
    });
    push("heading-order", "warning", "Пропущены уровни заголовков", "Не перескакивайте с h2 сразу на h4.", skipped);

    if (!document.querySelector("main, [role=main]")) {
      issues.push({ id: "main", severity: "warning", title: "Нет области <main>",
        hint: "Оберните основной контент в <main> — это точка входа для скринридеров.", count: 1, samples: [] });
    }
    if (!document.querySelector("nav, [role=navigation]") && document.querySelectorAll("a[href]").length > 4) {
      issues.push({ id: "nav", severity: "info", title: "Навигация без <nav>",
        hint: "Группу ссылок навигации стоит обернуть в <nav>.", count: 1, samples: [] });
    }
    var htmlLang = document.documentElement.getAttribute("lang");
    if (!htmlLang) {
      issues.push({ id: "lang", severity: "warning", title: "Не указан язык страницы",
        hint: 'Добавьте <html lang="ru">, иначе синтез речи прочитает текст неверно.', count: 1, samples: [] });
    }

    // 6. Клавиатура и фокус
    var fakeButtons = Array.prototype.filter.call(document.querySelectorAll("div[onclick], span[onclick], li[onclick]"),
      function (el) { return !el.hasAttribute("tabindex") || !el.getAttribute("role"); });
    push("keyboard", "critical", "Клик на неинтерактивном элементе",
      "Используйте <button>, либо добавьте role, tabindex=\\"0\\" и обработчик Enter/Space.", fakeButtons);

    push("tabindex", "warning", "Положительный tabindex",
      "tabindex больше нуля ломает естественный порядок обхода — используйте 0.",
      Array.prototype.filter.call(document.querySelectorAll("[tabindex]"),
        function (el) { return parseInt(el.getAttribute("tabindex"), 10) > 0; }));

    var noFocus = Array.prototype.filter.call(document.querySelectorAll("a[href], button, input, select, textarea"),
      function (el) {
        var cs = getComputedStyle(el);
        return cs.outlineStyle === "none" && !/inset/.test(cs.boxShadow) && !el.matches(":focus-visible");
      }).filter(function () { return true; });
    if (noFocus.length && !/:focus/.test(Array.prototype.map.call(document.styleSheets, function (s) {
      try { return Array.prototype.map.call(s.cssRules, function (r) { return r.cssText; }).join(""); } catch (err) { return ""; }
    }).join(""))) {
      push("focus-visible", "warning", "Не задан видимый фокус",
        "Добавьте стиль :focus-visible, иначе пользователь клавиатуры не видит, где находится.", noFocus.slice(0, 4));
    }

    var small = Array.prototype.filter.call(document.querySelectorAll("a[href], button, [role=button]"), function (el) {
      var r = el.getBoundingClientRect();
      return r.width > 0 && (r.width < 44 || r.height < 44);
    });
    push("tap-target", "info", "Мелкие цели нажатия", "Минимальный размер интерактивной области — 44×44 px.", small);

    var weight = { critical: 12, warning: 6, info: 2 };
    var penalty = issues.reduce(function (sum, i) { return sum + weight[i.severity] * Math.min(i.count, 5); }, 0);
    var report = {
      score: Math.max(0, 100 - penalty),
      total: issues.reduce(function (s, i) { return s + i.count; }, 0),
      issues: issues,
    };
    parent.postMessage({ __ip: "a11y", report: report }, "*");
  }

  window.addEventListener("message", function (e) {
    if (e.data && e.data.__ip === "a11y_run") audit();
  });
})();
</script>
`;
