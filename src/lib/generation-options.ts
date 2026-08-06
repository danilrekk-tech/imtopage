/** Общие настройки генерации: стек, дизайн-токены, флаги. Клиент + сервер. */

export const FRAMEWORKS = [
  { id: "html", label: "HTML + Tailwind", hint: "Один самодостаточный файл" },
  { id: "react", label: "React + Tailwind + Lucide", hint: "JSX-компоненты, иконки Lucide" },
  { id: "vue", label: "Vue 3 + Tailwind", hint: "SFC-подобная структура" },
] as const;

export type FrameworkId = (typeof FRAMEWORKS)[number]["id"];

export const FONTS = ["Inter", "Roboto", "Plus Jakarta Sans", "Outfit"] as const;
export type FontId = (typeof FONTS)[number];

export const RADII = [
  { id: "sm", label: "Малое", value: "6px" },
  { id: "md", label: "Среднее", value: "12px" },
  { id: "lg", label: "Большое", value: "20px" },
  { id: "full", label: "Круглое", value: "9999px" },
] as const;
export type RadiusId = (typeof RADII)[number]["id"];

export type GenerationOptions = {
  framework: FrameworkId;
  primaryColor: string;
  fontFamily: FontId;
  radius: RadiusId;
  enhanceText: boolean;
  themeToggle: boolean;
};

export const DEFAULT_OPTIONS: GenerationOptions = {
  framework: "html",
  primaryColor: "#F5A524",
  fontFamily: "Inter",
  radius: "md",
  enhanceText: false,
  themeToggle: true,
};

export const PRESET_COLORS = [
  "#F5A524",
  "#10B981",
  "#3B82F6",
  "#E11D48",
  "#8B5CF6",
  "#0EA5E9",
] as const;

const FRAMEWORK_RULES: Record<FrameworkId, string> = {
  html: `Формат вывода: ОДИН самодостаточный HTML-документ. Tailwind через CDN (https://cdn.tailwindcss.com), логика — чистый JS в <script>.`,
  react: `Формат вывода: ОДИН HTML-документ, внутри которого React 18 через CDN (react, react-dom UMD) и Babel Standalone.
Код пиши как чистые React-компоненты с хуками (function Header(){...}) в <script type="text/babel">, разбей страницу на осмысленные компоненты (Header, Hero, Features, FAQ, Footer).
Иконки — только Lucide (подключи https://unpkg.com/lucide@latest и рендери через lucide.createIcons(), либо inline SVG из набора Lucide). Стилизация — Tailwind CDN.`,
  vue: `Формат вывода: ОДИН HTML-документ, внутри которого Vue 3 через CDN (https://unpkg.com/vue@3/dist/vue.global.js).
Код пиши компонентами Composition API (setup(), ref, computed), смонтированными в #app, разбей страницу на осмысленные компоненты. Стилизация — Tailwind CDN. Иконки — Lucide (inline SVG из набора Lucide).`,
};

/** Формирует директиву для модели по выбранным настройкам. */
export function buildOptionsDirective(options: GenerationOptions, pageCount: number): string {
  const radius = RADII.find((r) => r.id === options.radius)?.value ?? "12px";
  const lines = [
    FRAMEWORK_RULES[options.framework],
    `Дизайн-токены (задай их в :root и используй везде, не хардкодь другие значения):
- --brand: ${options.primaryColor} — основной/акцентный цвет кнопок, ссылок, активных состояний
- --radius: ${radius} — скругление кнопок, полей, карточек
- Шрифт: "${options.fontFamily}" (подключи Google Fonts), fallback — system-ui`,
    `Иконки: используй ТОЛЬКО иконки из набора Lucide (правильные имена: menu, x, chevron-down, arrow-right, check, star, mail, phone, sun, moon). Никаких эмодзи и случайных заглушек.`,
  ];

  if (options.themeToggle) {
    lines.push(
      `Обязательно добавь в шапку рабочий переключатель светлой/тёмной темы (иконки sun/moon): он переключает класс "dark" на <html>, все цвета описаны через CSS-переменные для обеих тем, выбор сохраняется в localStorage.`,
    );
  }

  if (options.enhanceText) {
    lines.push(
      `Улучшение текста ВКЛЮЧЕНО: если текст на скриншоте нечитаем, размыт или это Lorem Ipsum — не копируй его, а напиши осмысленный продающий копирайт на русском языке, соответствующий тематике и контексту блока (заголовки, подзаголовки, буллеты, CTA).`,
    );
  } else {
    lines.push(`Улучшение текста выключено: переноси текст со скриншота максимально дословно.`);
  }

  if (pageCount > 1) {
    lines.push(
      `Загружено ${pageCount} экрана — собери многостраничный прототип В ОДНОМ файле: каждая страница это отдельная секция/компонент, переключение через рабочую навигацию (клик по пункту меню или кнопке показывает нужную страницу, обновляет hash в адресе и активный пункт меню). Ссылки между страницами обязаны работать.`,
    );
  }

  return `\n\nНАСТРОЙКИ ПОЛЬЗОВАТЕЛЯ (высший приоритет):\n${lines.join("\n\n")}`;
}
