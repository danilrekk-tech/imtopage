/** Настройки генерации и дизайн-система прототипа. Клиент + сервер. */

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

export const SPACING = [
  { id: "compact", label: "Компактный", value: "0.75" },
  { id: "balanced", label: "Сбалансированный", value: "1" },
  { id: "airy", label: "Воздушный", value: "1.25" },
] as const;
export type SpacingId = (typeof SPACING)[number]["id"];

export const SHADOWS = [
  { id: "none", label: "Без теней", value: "none" },
  { id: "soft", label: "Мягкие", value: "0 8px 30px rgba(15,23,42,.10)" },
  { id: "strong", label: "Выраженные", value: "0 16px 50px rgba(15,23,42,.18)" },
] as const;
export type ShadowId = (typeof SHADOWS)[number]["id"];

export type GenerationOptions = {
  framework: FrameworkId;
  primaryColor: string;
  secondaryColor: string;
  backgroundColor: string;
  surfaceColor: string;
  textColor: string;
  mutedColor: string;
  borderColor: string;
  fontFamily: FontId;
  radius: RadiusId;
  spacing: SpacingId;
  shadow: ShadowId;
  enhanceText: boolean;
  themeToggle: boolean;
};

export const DEFAULT_OPTIONS: GenerationOptions = {
  framework: "html",
  primaryColor: "#8B5CF6",
  secondaryColor: "#6D5DF5",
  backgroundColor: "#070B16",
  surfaceColor: "#111827",
  textColor: "#F8FAFC",
  mutedColor: "#94A3B8",
  borderColor: "#263247",
  fontFamily: "Inter",
  radius: "md",
  spacing: "balanced",
  shadow: "soft",
  enhanceText: false,
  themeToggle: true,
};

export const PRESET_COLORS = ["#8B5CF6", "#7C3AED", "#06B6D4", "#10B981", "#3B82F6", "#F59E0B", "#EF4444"] as const;

export type TokenPreset = {
  id: string;
  name: string;
  options: Pick<GenerationOptions, "primaryColor" | "secondaryColor" | "backgroundColor" | "surfaceColor" | "textColor" | "mutedColor" | "borderColor" | "fontFamily" | "radius" | "spacing" | "shadow">;
};

const FRAMEWORK_RULES: Record<FrameworkId, string> = {
  html: `Формат вывода: ОДИН самодостаточный HTML-документ. Tailwind через CDN (https://cdn.tailwindcss.com), логика — чистый JS в <script>.`,
  react: `Формат вывода: ОДИН HTML-документ, внутри которого React 18 через CDN и Babel Standalone. Код пиши как чистые React-компоненты. Иконки — только Lucide. Стилизация — Tailwind CDN.`,
  vue: `Формат вывода: ОДИН HTML-документ, внутри которого Vue 3 через CDN. Код пиши компонентами Composition API. Стилизация — Tailwind CDN. Иконки — Lucide.`,
};

export function buildOptionsDirective(options: GenerationOptions, pageCount: number): string {
  const radius = RADII.find((r) => r.id === options.radius)?.value ?? "12px";
  const spacing = SPACING.find((r) => r.id === options.spacing)?.value ?? "1";
  const shadow = SHADOWS.find((r) => r.id === options.shadow)?.value ?? SHADOWS[1].value;
  const lines = [
    FRAMEWORK_RULES[options.framework],
    `ДИЗАЙН-СИСТЕМА — это обязательные токены. Создай CSS variables в :root и используй их последовательно, не хардкодь другие значения:
- --brand: ${options.primaryColor}
- --brand-secondary: ${options.secondaryColor}
- --background: ${options.backgroundColor}
- --surface: ${options.surfaceColor}
- --text: ${options.textColor}
- --muted: ${options.mutedColor}
- --border: ${options.borderColor}
- --radius: ${radius}
- --spacing-scale: ${spacing}
- --shadow: ${shadow}
- font-family: "${options.fontFamily}", system-ui, sans-serif
Используй токены для фона, карточек, текста, границ, CTA, hover/focus, форм, навигации и декоративных элементов. Для контрастных состояний автоматически подбирай оттенки от этих базовых цветов.`,
    `Иконки: только Lucide. Никаких эмодзи и случайных заглушек.`,
  ];
  if (options.themeToggle) lines.push(`Добавь рабочий переключатель светлой/тёмной темы. Обе темы должны использовать отдельный набор CSS variables, выбор сохраняется в localStorage.`);
  if (options.enhanceText) lines.push(`Улучшение текста ВКЛЮЧЕНО: восстанови нечитаемый текст осмысленным продающим копирайтом на русском языке.`);
  else lines.push(`Улучшение текста выключено: переноси текст со скриншота максимально дословно.`);
  if (pageCount > 1) lines.push(`Загружено ${pageCount} экрана — собери многостраничный прототип в одном файле с рабочей навигацией и hash.`);
  return `\n\nНАСТРОЙКИ ПОЛЬЗОВАТЕЛЯ (высший приоритет):\n${lines.join("\n\n")}`;
}
