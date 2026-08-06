/** Инъекция режимов «Инспектор» и «Скопировать компонент» в превью-документ. */

export type PreviewMode = "off" | "inspect" | "copy";

const SCRIPT = (mode: "inspect" | "copy") => `
<style id="__ip_tools">
  .__ip_hl { outline: 2px solid #F5A524 !important; outline-offset: -2px; cursor: ${mode === "copy" ? "copy" : "text"}; }
  .__ip_badge { position: fixed; z-index: 2147483647; bottom: 12px; left: 12px; font: 600 12px/1.2 system-ui, sans-serif;
    background: #0B0F17; color: #F5A524; border: 1px solid #F5A524; border-radius: 8px; padding: 6px 10px; }
</style>
<script id="__ip_tools_js">
(function () {
  var MODE = ${JSON.stringify(mode)};
  var badge = document.createElement("div");
  badge.className = "__ip_badge";
  badge.textContent = MODE === "copy" ? "Наведите на блок и кликните — код скопируется" : "Кликните по элементу, чтобы изменить текст · Alt+клик — цвет";
  document.body.appendChild(badge);

  var current = null;
  function sectionOf(el) {
    if (MODE !== "copy") return el;
    var node = el;
    while (node && node !== document.body) {
      if (/^(HEADER|NAV|SECTION|FOOTER|MAIN|ARTICLE|ASIDE)$/.test(node.tagName)) return node;
      node = node.parentElement;
    }
    return el;
  }
  function clear() { if (current) current.classList.remove("__ip_hl"); current = null; }
  document.addEventListener("mouseover", function (e) {
    var target = sectionOf(e.target);
    if (target === current || !target || target === document.body) return;
    clear();
    current = target;
    current.classList.add("__ip_hl");
  }, true);
  document.addEventListener("mouseleave", clear, true);

  document.addEventListener("click", function (e) {
    var target = sectionOf(e.target);
    if (!target) return;
    e.preventDefault();
    e.stopPropagation();
    if (MODE === "copy") {
      var clone = target.cloneNode(true);
      clone.querySelectorAll(".__ip_hl").forEach(function (n) { n.classList.remove("__ip_hl"); });
      clone.classList.remove("__ip_hl");
      parent.postMessage({ __ip: "copy", html: clone.outerHTML }, "*");
      badge.textContent = "Код блока скопирован";
      return;
    }
    if (e.altKey) {
      var color = window.prompt("Цвет элемента (HEX или CSS-цвет):", "");
      if (color) target.style.color = color;
      sync();
      return;
    }
    target.setAttribute("contenteditable", "true");
    target.focus();
    target.addEventListener("blur", function handler() {
      target.removeAttribute("contenteditable");
      target.removeEventListener("blur", handler);
      sync();
    });
  }, true);

  function sync() {
    var doc = document.documentElement.cloneNode(true);
    doc.querySelectorAll("#__ip_tools, #__ip_tools_js, .__ip_badge").forEach(function (n) { n.remove(); });
    doc.querySelectorAll(".__ip_hl").forEach(function (n) { n.classList.remove("__ip_hl"); });
    doc.querySelectorAll("[contenteditable]").forEach(function (n) { n.removeAttribute("contenteditable"); });
    parent.postMessage({ __ip: "html", html: "<!DOCTYPE html>" + doc.outerHTML }, "*");
  }
})();
</script>
`;

export function withPreviewTools(html: string, mode: PreviewMode): string {
  if (mode === "off") return html;
  const script = SCRIPT(mode);
  return html.includes("</body>")
    ? html.replace(/<\/body>/i, `${script}</body>`)
    : html + script;
}
