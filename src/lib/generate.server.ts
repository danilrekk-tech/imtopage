import { createClient } from "@supabase/supabase-js";
import { getRequestHeader } from "@tanstack/react-start/server";

import type { Database } from "@/integrations/supabase/types";

// Лимиты генераций отключены.

export function admin() {
  const url = process.env["SUPABASE_URL"]!;
  const key = process.env["SUPABASE_SERVICE_ROLE_KEY"]!;
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) {
          headers.delete("Authorization");
        }
        headers.set("apikey", key);
        return fetch(input, { ...init, headers });
      },
    },
  });
}

/** Returns the signed-in user id when the request carries a valid bearer token. */
export async function optionalUserId(): Promise<string | null> {
  const header = getRequestHeader("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  const token = header.slice(7);
  if (token.split(".").length !== 3) return null;
  const { data, error } = await admin().auth.getUser(token);
  if (error || !data.user) return null;
  return data.user.id;
}

/** Текущий пользователь (id и e-mail), если запрос авторизован. */
export async function optionalUser(): Promise<{ id: string; email: string | null } | null> {
  const header = getRequestHeader("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  const token = header.slice(7);
  if (token.split(".").length !== 3) return null;
  const { data, error } = await admin().auth.getUser(token);
  if (error || !data.user) return null;
  return { id: data.user.id, email: data.user.email ?? null };
}

export async function log(projectId: string, step: string, status: string, errorMessage?: string) {
  await admin()
    .from("generation_logs")
    .insert({ project_id: projectId, step, status, error_message: errorMessage ?? null });
}

/** Ведёт статистику использования. Лимиты не применяются. */
export async function trackUsage(userId: string | null) {
  if (!userId) return;
  const db = admin();
  const day = new Date().toISOString().slice(0, 10);
  const subject = `user:${userId}`;
  const { data: row } = await db
    .from("usage_counters")
    .select("count")
    .eq("subject", subject)
    .eq("day", day)
    .maybeSingle();
  await db
    .from("usage_counters")
    .upsert({ subject, day, count: (row?.count ?? 0) + 1 }, { onConflict: "subject,day" });
}

export const SYSTEM_PROMPT = `Ты — эксперт по фронтенд-разработке и точному воссозданию веб-дизайна по изображению.

Тебе дан скриншот веб-страницы. Твоя задача — воссоздать её максимально точно как единый самодостаточный HTML-файл с inline CSS (в тегах <style>) и inline JS (в тегах <script>), используя Tailwind CDN для утилитарных классов, где это ускоряет работу.

ТРЕБОВАНИЯ К ТОЧНОСТИ:
- Сохрани точную структуру блоков сверху вниз, как на изображении
- Определи цветовую палитру по пикселям изображения (основной, акцентный, фоновый цвета) и используй именно её через CSS-переменные в :root
- Определи по засечкам/пропорциям шрифт (sans-serif гротеск / с засечками) и подбери ближайший доступный веб-шрифт (Google Fonts), сохрани относительные размеры заголовков и текста
- Сохрани пропорции колонок, отступы между секциями, скругления углов карточек и кнопок
- Для фотографий и иллюстраций, которые невозможно воспроизвести точно, используй смысловые SVG-плейсхолдеры или градиентные заглушки в похожей цветовой гамме — никогда не оставляй пустые области

ТРЕБОВАНИЯ К ИНТЕРАКТИВНОСТИ (это критично, элементы должны РЕАЛЬНО РАБОТАТЬ, не просто визуально дублировать):
- Аккордеоны (FAQ и подобное) — клик разворачивает/сворачивает контент с плавной CSS-анимацией высоты, иконка +/– меняется на -/×
- Табы — переключение контента без перезагрузки, активный таб визуально выделен
- Слайдеры/карусели (отзывы, кейсы) — работают стрелками и точками-индикаторами, автоматически листаются каждые 5 секунд с паузой при наведении
- Выпадающие меню в навигации — открываются по клику/hover, закрываются по клику вне области
- Формы — с client-side валидацией обязательных полей (подсветка красным при пустом поле), при отправке показывают сообщение об успехе без реальной отправки на сервер (это демо)
- Sticky-хедер — остаётся видимым при скролле, может менять фон при скролле вниз
- Hover-состояния — на всех кнопках, карточках, ссылках должны быть плавные transition-эффекты (transform, box-shadow, цвет)
- Плавный скролл (scroll-behavior: smooth) к якорям меню
- Мобильная адаптивность — гамбургер-меню на узких экранах, сетки перестраиваются в колонку

Если тебе передан previous_html и edit_instruction — не переписывай всё с нуля, внеси точечное изменение, сохранив всю остальную структуру и код без изменений.

Сначала внутри тегов <analysis> кратко перечисли, какие блоки и интерактивные компоненты ты обнаружил на изображении.

Затем выведи ПОЛНЫЙ финальный код внутри тегов <final_code>. Это должен быть валидный самодостаточный HTML-документ, готовый к рендеру в iframe без внешних зависимостей, кроме Tailwind CDN и Google Fonts CDN.`;

type Content = { type: "text"; text: string } | { type: "image_url"; image_url: { url: string } };

function extractHtml(raw: string): string {
  const candidates = [
    raw.match(/<final_code>([\s\S]*?)<\/final_code>/)?.[1],
    raw.match(/```(?:html)?\s*([\s\S]*?)```/)?.[1],
    // Крайний случай: модель вернула документ без обёртки.
    raw.match(/<!DOCTYPE html[\s\S]*<\/html>/i)?.[0],
    raw.match(/<html[\s\S]*<\/html>/i)?.[0],
  ];
  for (const candidate of candidates) {
    const value = candidate?.trim();
    if (value && /<\/html>|<body/i.test(value)) return value;
  }
  return "";
}

/* ============================================================================
 * Цепочка AI-провайдеров.
 * Приоритет (режим "auto"): Gemini → OpenRouter (free vision) → Lovable AI.
 * Режим задаётся переменной окружения AI_PROVIDER_MODE.
 * ==========================================================================*/

export type ProviderName = "gemini" | "openrouter_fallback" | "lovable_fallback" | "cache";
export type ProviderMode = "auto" | "gemini_only" | "lovable_only";

export function providerMode(): ProviderMode {
  const raw = (process.env["AI_PROVIDER_MODE"] ?? "auto").trim().toLowerCase();
  return raw === "gemini_only" || raw === "lovable_only" ? raw : "auto";
}

// Модели Gemini (проверяются по порядку) — прямой Google AI API.
const GEMINI_MODELS = ["gemini-3.6-flash", "gemini-2.5-flash", "gemini-flash-latest"];
// Бесплатные vision-модели OpenRouter (актуальный список, проверяются по порядку).
const OPENROUTER_MODELS = [
  "google/gemma-4-31b-it:free",
  "google/gemma-4-26b-a4b-it:free",
  "nvidia/nemotron-nano-12b-v2-vl:free",
];

class ProviderError extends Error {
  retryable: boolean;
  constructor(message: string, retryable: boolean) {
    super(message);
    this.retryable = retryable;
  }
}

function parseResult(raw: string): { html: string; analysis: string } | null {
  const analysis = raw.match(/<analysis>([\s\S]*?)<\/analysis>/)?.[1]?.trim() ?? "";
  const html = extractHtml(raw);
  return html ? { html, analysis } : null;
}

/** 1) Прямой вызов Google Gemini API (vision) с перебором моделей. */
async function callGemini(content: Content[]): Promise<{ html: string; analysis: string }> {
  const key = process.env["GEMINI_API_KEY"];
  if (!key) throw new ProviderError("GEMINI_API_KEY не задан.", true);

  const parts = content.map((item) => {
    if (item.type === "text") return { text: item.text };
    const match = /^data:(.+?);base64,(.+)$/.exec(item.image_url.url);
    if (!match) throw new ProviderError("Gemini принимает только base64-изображения.", true);
    return { inlineData: { mimeType: match[1]!, data: match[2]! } };
  });

  let lastError = "Gemini недоступен.";
  let fatal = false;

  for (const model of GEMINI_MODELS) {
    let res: Response;
    try {
      res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": key },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
            contents: [{ role: "user", parts }],
            generationConfig: {
              temperature: 0.2,
              maxOutputTokens: 64000,
              // Без «мышления»: иначе бюджет токенов уходит в размышления и ответ обрывается.
              thinkingConfig: { thinkingBudget: 0 },
            },
          }),
        },
      );
    } catch {
      lastError = "Gemini недоступен (сеть/таймаут).";
      continue;
    }

    if (!res.ok) {
      const text = (await res.text()).slice(0, 300);
      lastError = `Gemini (${model}) ошибка ${res.status}: ${text}`;
      // Неверный ключ — перебирать модели бессмысленно.
      if (res.status === 401 || (res.status === 400 && /API key/i.test(text))) {
        fatal = true;
        break;
      }
      continue;
    }

    const json = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
    };
    const raw = (json.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? "").join("");
    const parsed = parseResult(raw);
    if (parsed) return parsed;
    lastError =
      json.candidates?.[0]?.finishReason === "MAX_TOKENS"
        ? `Gemini (${model}): ответ не поместился в лимит токенов.`
        : `Gemini (${model}) вернул ответ без HTML.`;
  }

  throw new ProviderError(lastError, !fatal);
}


/** 2) OpenRouter (бесплатные vision-модели). */
async function callOpenRouter(content: Content[]): Promise<{ html: string; analysis: string }> {
  const key = process.env["OPENROUTER_API_KEY"];
  if (!key) throw new ProviderError("OPENROUTER_API_KEY не задан.", true);

  let lastError = "OpenRouter недоступен.";
  for (const model of OPENROUTER_MODELS) {
    let res: Response;
    try {
      res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`,
          "HTTP-Referer": "https://imtopage.lovable.app",
          "X-Title": "Image to Interactive Page",
        },
        body: JSON.stringify({
          model,
          // Лимит вывода бесплатных моделей ниже 64k — иначе запрос отклоняется.
          max_tokens: 32000,
          temperature: 0.2,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content },
          ],
        }),
      });

    } catch {
      lastError = "OpenRouter недоступен (сеть/таймаут).";
      continue;
    }
    if (!res.ok) {
      lastError = `OpenRouter ошибка ${res.status}: ${(await res.text()).slice(0, 200)}`;
      continue;
    }
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const parsed = parseResult(json.choices?.[0]?.message?.content ?? "");
    if (parsed) return parsed;
    lastError = `OpenRouter (${model}) вернул ответ без HTML.`;
  }
  throw new ProviderError(lastError, true);
}

async function requestModel(content: Content[], key: string, temperature: number) {
  return fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Lovable-API-Key": key },
    body: JSON.stringify({
      model: "google/gemini-3.6-flash",
      max_tokens: 64000,
      temperature,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content },
      ],
    }),
  });
}

/** 3) Встроенный AI-коннектор Lovable (LOVABLE_API_KEY) — прежняя реализация. */
export async function callLovable(content: Content[]): Promise<{
  html: string;
  analysis: string;
}> {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new ProviderError("AI недоступен: отсутствует ключ шлюза Lovable.", false);

  let lastError = "Не удалось получить ответ AI.";
  // До трёх попыток: сетевые сбои, 5xx, 429 и пустые/невалидные ответы.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (attempt > 0) await new Promise((resolve) => setTimeout(resolve, 1200 * attempt));

    let res: Response;
    try {
      res = await requestModel(content, key, attempt === 0 ? 0.2 : 0.4);
    } catch {
      lastError = "Сеть недоступна при обращении к AI.";
      continue;
    }

    if (!res.ok) {
      const text = await res.text();
      if (res.status === 402) throw new Error("Закончились AI-кредиты рабочего пространства.");
      if (res.status === 429 || res.status >= 500) {
        lastError =
          res.status === 429
            ? "Слишком много запросов к AI. Попробуйте через минуту."
            : `Ошибка AI (${res.status}).`;
        continue;
      }
      throw new Error(`Ошибка AI (${res.status}): ${text.slice(0, 300)}`);
    }

    const json = (await res.json()) as {
      choices?: { message?: { content?: string }; finish_reason?: string }[];
    };
    const raw = json.choices?.[0]?.message?.content ?? "";
    const parsed = parseResult(raw);
    if (parsed) return parsed;

    lastError =
      json.choices?.[0]?.finish_reason === "length"
        ? "Ответ AI не поместился в лимит токенов. Попробуйте изображение попроще."
        : "Не удалось извлечь код из ответа AI.";
  }

  throw new Error(lastError);
}

/** Единая точка вызова AI: цепочка провайдеров согласно AI_PROVIDER_MODE. */
export async function callModel(content: Content[]): Promise<{
  html: string;
  analysis: string;
  provider: ProviderName;
}> {
  const mode = providerMode();

  if (mode === "lovable_only") {
    try {
      const result = await callLovable(content);
      console.info("[ai-provider] lovable_fallback (lovable_only)");
      return { ...result, provider: "lovable_fallback" };
    } catch (error) {
      // Кредиты Lovable закончились — не роняем сервис, идём по внешним провайдерам.
      const message = error instanceof Error ? error.message : "Lovable AI недоступен.";
      console.warn("[ai-provider] lovable_only failed, переключаюсь на внешние:", message);
    }
  }

  const errors: string[] = [];


  try {
    const result = await callGemini(content);
    console.info("[ai-provider] gemini");
    return { ...result, provider: "gemini" };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Gemini недоступен.";
    console.warn("[ai-provider] gemini failed:", message);
    errors.push(message);
    if (mode === "gemini_only" || (error instanceof ProviderError && !error.retryable)) {
      throw new Error(errors.join(" | "));
    }
  }

  try {
    const result = await callOpenRouter(content);
    console.info("[ai-provider] openrouter_fallback");
    return { ...result, provider: "openrouter_fallback" };
  } catch (error) {
    const message = error instanceof Error ? error.message : "OpenRouter недоступен.";
    console.warn("[ai-provider] openrouter failed:", message);
    errors.push(message);
  }

  try {
    const result = await callLovable(content);
    console.info("[ai-provider] lovable_fallback");
    return { ...result, provider: "lovable_fallback" };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Lovable AI недоступен.";
    console.warn("[ai-provider] lovable failed:", message);
    errors.push(message);
    throw new Error(
      `Все AI-провайдеры недоступны (Gemini → OpenRouter → Lovable AI). Детали: ${errors.join(" | ")}`,
    );
  }

}

/* ============================ Кеш по SHA-256 =============================*/

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const buffer = await crypto.subtle.digest("SHA-256", bytes as unknown as ArrayBuffer);
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function getCached(imageHash: string) {
  const { data } = await admin()
    .from("generation_cache")
    .select("result, analysis, provider")
    .eq("image_hash", imageHash)
    .maybeSingle();
  return data ?? null;
}

export async function saveCache(
  imageHash: string,
  html: string,
  analysis: string,
  provider: string,
) {
  await admin()
    .from("generation_cache")
    .upsert(
      { image_hash: imageHash, result: html, analysis, provider },
      { onConflict: "image_hash" },
    );
}

/* ============================== Rate limit ===============================*/

const RATE_LIMIT_PER_HOUR = Number(process.env["RATE_LIMIT_PER_HOUR"] ?? 20);

/** Не больше N генераций в час на пользователя/устройство/IP. */
export async function assertRateLimit(subject: string) {
  const db = admin();
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count } = await db
    .from("rate_limit_events")
    .select("id", { count: "exact", head: true })
    .eq("subject", subject)
    .gte("created_at", since);
  if ((count ?? 0) >= RATE_LIMIT_PER_HOUR) {
    throw new Error(`Слишком много генераций (${RATE_LIMIT_PER_HOUR} в час). Попробуйте позже.`);
  }
  await db.from("rate_limit_events").insert({ subject });
}

export function requestSubject(userId: string | null, deviceId: string): string {
  if (userId) return `user:${userId}`;
  const ip =
    getRequestHeader("cf-connecting-ip") ??
    getRequestHeader("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown";
  return `guest:${deviceId}:${ip}`;
}

export async function signedUrl(path: string | null): Promise<string | null> {
  if (!path) return null;
  const { data } = await admin()
    .storage.from("screenshots")
    .createSignedUrl(path, 60 * 60);
  return data?.signedUrl ?? null;
}
