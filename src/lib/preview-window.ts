/** Открывает сгенерированный HTML в отдельной вкладке как настоящую страницу. */
export function openHtmlInNewWindow(html: string, title = "Сгенерированная страница") {
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, "_blank", "noopener,noreferrer");
  if (!win) {
    URL.revokeObjectURL(url);
    throw new Error(`Браузер заблокировал новое окно («${title}»). Разрешите всплывающие окна.`);
  }
  // Даём странице загрузиться, затем освобождаем объект URL.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
