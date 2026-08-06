import JSZip from "jszip";

import type { FrameworkId } from "./generation-options";

const README = `# Прототип, собранный из скриншота

Файл index.html самодостаточен — откройте его в браузере.
Стек: %STACK%
`;

export async function downloadZip(html: string, framework: FrameworkId, title = "prototype") {
  const zip = new JSZip();
  zip.file("index.html", html);
  zip.file("README.md", README.replace("%STACK%", framework));
  const blob = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${title.replace(/[^\w-]+/g, "-").toLowerCase() || "prototype"}.zip`;
  link.click();
  URL.revokeObjectURL(url);
}

export function downloadHtml(html: string, title = "prototype") {
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${title.replace(/[^\w-]+/g, "-").toLowerCase() || "prototype"}.html`;
  link.click();
  URL.revokeObjectURL(url);
}

/** Открывает результат в CodeSandbox через define-API (POST-форма). */
export function openInCodeSandbox(html: string) {
  const parameters = {
    files: {
      "index.html": { content: html },
      "package.json": { content: { name: "prototype", dependencies: {} } },
      "sandbox.config.json": { content: { template: "static" } },
    },
  };

  const form = document.createElement("form");
  form.method = "POST";
  form.action = "https://codesandbox.io/api/v1/sandboxes/define";
  form.target = "_blank";
  form.style.display = "none";

  const input = document.createElement("input");
  input.type = "hidden";
  input.name = "parameters";
  input.value = toBase64Url(JSON.stringify(parameters));
  form.appendChild(input);

  document.body.appendChild(form);
  form.submit();
  form.remove();
}

function toBase64Url(value: string) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
