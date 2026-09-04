/**
 * Режим «Точное воспроизведение дизайна».
 * Формирует системный промт для AI, который анализирует скриншот и выдаёт
 * Reconstruction Prompt — инструкцию для AI-кодера (Lovable, Cursor, v0 и т.д.).
 * Режим НЕ проектирует новый дизайн и НЕ предлагает улучшений.
 */

export const RECONSTRUCTION_TARGETS = [
  { id: "lovable", label: "Lovable", hint: "React + Tailwind + Lucide, custom CSS разрешён" },
  { id: "cursor", label: "Cursor", hint: "Пофайловые инструкции для IDE-агента" },
  { id: "claude-code", label: "Claude Code", hint: "Терминальный агент, пошаговый план файлов" },
  { id: "v0", label: "v0", hint: "Next.js + Tailwind + shadcn-совместимая разметка" },
  { id: "generic", label: "Generic AI Coder", hint: "Универсальный формат без привязки к инструменту" },
] as const;

export type ReconstructionTarget = (typeof RECONSTRUCTION_TARGETS)[number]["id"];

export const RECONSTRUCTION_DEPTHS = [
  { id: "analysis", label: "Точный визуальный анализ", hint: "Только разбор макета, без промта для кодера" },
  { id: "prompt", label: "Анализ + Reconstruction Prompt", hint: "Полный промт из 15 разделов + Visual Fidelity Check" },
] as const;

export type ReconstructionDepth = (typeof RECONSTRUCTION_DEPTHS)[number]["id"];

export const DEFAULT_RECONSTRUCTION_DEPTH: ReconstructionDepth = "prompt";
export const DEFAULT_RECONSTRUCTION_TARGET: ReconstructionTarget = "lovable";

const TARGET_DIRECTIVES: Record<ReconstructionTarget, string> = {
  lovable: `IMPLEMENTATION TARGET — Lovable:
- Стек строго: React + Tailwind CSS + иконки Lucide.
- Реализовать именно существующий визуальный эталон со скриншота, а не «похожий» интерфейс.
- Tailwind-утилиты не должны ограничивать дизайн: если для точного воспроизведения нужен custom CSS (arbitrary values, отдельный <style>, CSS-переменные, clip-path, сложные градиенты) — использовать его.
- Не заменять сложные визуальные композиции стандартными карточками/секциями UI-кита.
- Не изобретать собственные компоненты там, где их внешний вид уже определён скриншотом.
- Указать структуру файлов: страница-роут + отдельные компоненты по секциям.`,
  cursor: `IMPLEMENTATION TARGET — Cursor:
- Стек: React + Tailwind CSS + Lucide (если проект не диктует иное).
- Дать пофайловый план: какой файл создать/изменить и какая секция в нём.
- Формулировать шаги так, чтобы их можно было применять последовательно в IDE-агенте.
- Custom CSS разрешён там, где утилит Tailwind не хватает для точности.`,
  "claude-code": `IMPLEMENTATION TARGET — Claude Code:
- Стек: React + Tailwind CSS + Lucide.
- Дать пошаговый план работы в терминале: список файлов, порядок создания, точки проверки.
- Каждый шаг должен быть проверяемым (что должно быть видно после шага).
- Custom CSS разрешён для точного воспроизведения.`,
  v0: `IMPLEMENTATION TARGET — v0:
- Стек: Next.js (App Router) + Tailwind CSS + Lucide; shadcn-совместимая разметка допустима, но не должна менять внешний вид.
- Один экран = одна страница-композиция с выделенными секционными компонентами.
- Custom CSS/arbitrary-значения Tailwind разрешены, если стандартных классов не хватает.`,
  generic: `IMPLEMENTATION TARGET — Generic AI Coder:
- Стек по умолчанию: React + Tailwind CSS + Lucide; при иной среде — эквивалент с сохранением визуала.
- Описывать требования технологически нейтрально, но однозначно по значениям (px, rem, %, hex).
- Custom CSS разрешён для точного воспроизведения.`,
};

const CORE_RULES = `ГЛАВНОЕ ПРАВИЛО:
«Не проектируй новый интерфейс. Не улучшай дизайн. Не используй screenshot только как источник вдохновения. Рассматривай screenshot как визуальный эталон, который необходимо реконструировать максимально близко».

- Никаких предложений по улучшению, редизайну, «современным» альтернативам.
- Если точное значение невозможно определить по изображению — укажи приблизительное значение с пометкой «≈», но не придумывай другое дизайнерское решение.
- Все значения давай в конкретных единицах: px/rem для размеров, hex для цветов, числа для font-weight и line-height.
- Пиши на русском языке, технические значения — латиницей.
- Не оборачивай ответ в markdown-код-блок целиком.`;

const ANALYSIS_CHECKLIST = `Проанализируй скриншот и извлеки:
общую композицию страницы; ширину контента и контейнера; расположение и размеры секций; пропорции колонок и grid; высоту основных блоков; Header; Hero; навигацию; карточки; CTA; Footer; typography hierarchy; примерные размеры заголовков и текста; font-weight; line-height; spacing; padding/margin; border-radius; borders; shadows; цвета и их примерные значения; background; gradients; overlays; изображения; aspect-ratio изображений; crop и object-position; визуальную иерархию; повторяющиеся компоненты; responsive-логику, если она может быть определена; наиболее важные визуальные особенности, без которых дизайн перестанет быть похожим на оригинал.`;

const SECTIONS = `Структура ответа — строго эти разделы, в этом порядке, каждый заголовок с номером и заглавными буквами:

1. VISUAL GOAL
2. GLOBAL LAYOUT
3. HEADER
4. HERO
5. SECTIONS
6. COMPONENTS
7. TYPOGRAPHY
8. COLORS
9. SPACING & DIMENSIONS
10. IMAGES
11. ICONOGRAPHY
12. RESPONSIVE BEHAVIOR
13. VISUAL PRIORITIES
14. DO NOT CHANGE
15. IMPLEMENTATION TARGET

В разделе DO NOT CHANGE явно перечисли, что нельзя интерпретировать или переделывать: композицию; визуальную иерархию; пропорции; расположение ключевых элементов; цветовую систему; характер изображений; размеры и отношения между основными блоками.

После раздела 15 добавь финальный блок:

VISUAL FIDELITY CHECK
После реализации сделай screenshot созданной страницы, сравни его с исходным screenshot и исправь наиболее заметные расхождения в: layout; proportions; typography; spacing; colors; image positioning; component dimensions; section heights.
Главный приоритет: VISUAL FIDELITY > DESIGN INTERPRETATION.`;

export function buildReconstructionSystemPrompt(
  target: ReconstructionTarget,
  depth: ReconstructionDepth,
): string {
  if (depth === "analysis") {
    return `Ты — эксперт по разбору визуального дизайна. Тебе дан скриншот существующего сайта.
Твоя задача — максимально точный визуальный анализ эталона, без генерации нового дизайна.

${CORE_RULES}

${ANALYSIS_CHECKLIST}

Формат ответа — структурированный разбор по разделам:
1. VISUAL GOAL
2. GLOBAL LAYOUT
3. HEADER
4. HERO
5. SECTIONS
6. COMPONENTS
7. TYPOGRAPHY
8. COLORS
9. SPACING & DIMENSIONS
10. IMAGES
11. ICONOGRAPHY
12. RESPONSIVE BEHAVIOR
13. VISUAL PRIORITIES

Не добавляй инструкций для AI-кодера и не предлагай план реализации.`;
  }

  return `Ты — эксперт по точной реконструкции веб-дизайна. Тебе дан скриншот готового сайта.
Твоя задача — превратить его в подробный Reconstruction Prompt, предназначенный непосредственно для AI-кодера, который затем воссоздаст этот дизайн.

${CORE_RULES}

${ANALYSIS_CHECKLIST}

${SECTIONS}

Содержимое раздела 15 (IMPLEMENTATION TARGET):
${TARGET_DIRECTIVES[target]}

Визуальные требования и сам дизайн не зависят от выбранного инструмента — под инструмент адаптируется только техническая часть.`;
}

export function buildReconstructionUserText(
  target: ReconstructionTarget,
  depth: ReconstructionDepth,
  imageCount: number,
  note?: string,
): string {
  const scope = imageCount > 1 ? `Дано ${imageCount} экрана(ов) одного дизайна.` : "Дан один экран.";
  const task =
    depth === "analysis"
      ? "Сделай точный визуальный анализ эталона."
      : `Сформируй Reconstruction Prompt для AI-кодера «${target}».`;
  return [scope, task, note?.trim() ? `Дополнительный контекст от пользователя: ${note.trim()}` : ""]
    .filter(Boolean)
    .join("\n");
}

export function reconstructionFileName(target: ReconstructionTarget): string {
  return `reconstruction-prompt-${target}.md`;
}
