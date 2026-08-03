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

export async function log(
  projectId: string,
  step: string,
  status: string,
  errorMessage?: string,
) {
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

type Content =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

export async function callModel(content: Content[]): Promise<{
  html: string;
  analysis: string;
}> {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new Error("AI недоступен: отсутствует ключ шлюза.");

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Lovable-API-Key": key },
    body: JSON.stringify({
      model: "google/gemini-3.6-flash",
      max_tokens: 32000,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content },
      ],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    if (res.status === 429) throw new Error("Слишком много запросов к AI. Попробуйте через минуту.");
    if (res.status === 402) throw new Error("Закончились AI-кредиты рабочего пространства.");
    throw new Error(`Ошибка AI (${res.status}): ${text.slice(0, 300)}`);
  }

  const json = (await res.json()) as {
    choices?: { message?: { content?: string }; finish_reason?: string }[];
  };
  const raw = json.choices?.[0]?.message?.content ?? "";
  if (!raw) throw new Error("AI вернул пустой ответ. Попробуйте ещё раз.");

  const analysis = raw.match(/<analysis>([\s\S]*?)<\/analysis>/)?.[1]?.trim() ?? "";
  let html = raw.match(/<final_code>([\s\S]*?)<\/final_code>/)?.[1]?.trim() ?? "";
  if (!html) {
    html = raw.match(/```html\s*([\s\S]*?)```/)?.[1]?.trim() ?? "";
  }
  if (!html) {
    if (json.choices?.[0]?.finish_reason === "length") {
      throw new Error("Ответ AI не поместился в лимит токенов. Попробуйте изображение попроще.");
    }
    throw new Error("Не удалось извлечь код из ответа AI. Попробуйте ещё раз.");
  }
  return { html, analysis };
}

export async function signedUrl(path: string | null): Promise<string | null> {
  if (!path) return null;
  const { data } = await admin().storage.from("screenshots").createSignedUrl(path, 60 * 60);
  return data?.signedUrl ?? null;
}
