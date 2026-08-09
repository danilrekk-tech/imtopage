import { admin } from "./generate.server";

export type ProviderKey = "gemini" | "openrouter" | "lovable";
export type HealthStatus = "up" | "down" | "unknown";

export type ProviderHealth = {
  provider: ProviderKey;
  status: HealthStatus;
  model: string | null;
  latency_ms: number | null;
  error: string | null;
  checked_at: string;
};

export const GEMINI_MODELS = ["gemini-3.6-flash", "gemini-2.5-flash", "gemini-flash-latest"];
export const OPENROUTER_MODELS = [
  "google/gemma-4-31b-it:free",
  "google/gemma-4-26b-a4b-it:free",
  "nvidia/nemotron-nano-12b-v2-vl:free",
];

/** Как часто перепроверять провайдеров (минуты). */
export function healthTtlMinutes(): number {
  const raw = Number(process.env["AI_HEALTH_TTL_MINUTES"] ?? 10);
  return Number.isFinite(raw) && raw > 0 ? raw : 10;
}

/** «Мышление» отключается только у моделей 2.5 — остальные отвергают этот параметр. */
export function geminiGenerationConfig(model: string, maxOutputTokens: number) {
  const base: Record<string, unknown> = { temperature: 0.2, maxOutputTokens };
  if (model.startsWith("gemini-2.5")) base["thinkingConfig"] = { thinkingBudget: 0 };
  return base;
}

async function ping(url: string, init: RequestInit, timeoutMs = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function checkGemini(): Promise<Omit<ProviderHealth, "checked_at">> {
  const key = process.env["GEMINI_API_KEY"];
  if (!key)
    return {
      provider: "gemini",
      status: "down",
      model: null,
      latency_ms: null,
      error: "GEMINI_API_KEY не задан",
    };
  let error = "нет доступных моделей";
  for (const model of GEMINI_MODELS) {
    const started = Date.now();
    try {
      const res = await ping(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": key },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: "ping" }] }],
            generationConfig: geminiGenerationConfig(model, 8),
          }),
        },
      );
      if (res.ok)
        return {
          provider: "gemini",
          status: "up",
          model,
          latency_ms: Date.now() - started,
          error: null,
        };
      error = `${model}: HTTP ${res.status}`;
    } catch {
      error = `${model}: сеть/таймаут`;
    }
  }
  return { provider: "gemini", status: "down", model: null, latency_ms: null, error };
}

async function checkOpenRouter(): Promise<Omit<ProviderHealth, "checked_at">> {
  const key = process.env["OPENROUTER_API_KEY"];
  if (!key)
    return {
      provider: "openrouter",
      status: "down",
      model: null,
      latency_ms: null,
      error: "OPENROUTER_API_KEY не задан",
    };
  let error = "нет доступных моделей";
  for (const model of OPENROUTER_MODELS) {
    const started = Date.now();
    try {
      const res = await ping("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`,
          "HTTP-Referer": "https://imtopage.lovable.app",
          "X-Title": "Image to Interactive Page",
        },
        body: JSON.stringify({
          model,
          max_tokens: 8,
          messages: [{ role: "user", content: "ping" }],
        }),
      });
      if (res.ok)
        return {
          provider: "openrouter",
          status: "up",
          model,
          latency_ms: Date.now() - started,
          error: null,
        };
      error = `${model}: HTTP ${res.status}`;
    } catch {
      error = `${model}: сеть/таймаут`;
    }
  }
  return { provider: "openrouter", status: "down", model: null, latency_ms: null, error };
}

async function checkLovable(): Promise<Omit<ProviderHealth, "checked_at">> {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key)
    return {
      provider: "lovable",
      status: "down",
      model: null,
      latency_ms: null,
      error: "LOVABLE_API_KEY не задан",
    };
  const model = "google/gemini-3.6-flash";
  const started = Date.now();
  try {
    const res = await ping("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": key },
      body: JSON.stringify({
        model,
        max_tokens: 8,
        messages: [{ role: "user", content: "ping" }],
      }),
    });
    if (res.ok)
      return { provider: "lovable", status: "up", model, latency_ms: Date.now() - started, error: null };
    return {
      provider: "lovable",
      status: "down",
      model,
      latency_ms: null,
      error: res.status === 402 ? "закончились кредиты (402)" : `HTTP ${res.status}`,
    };
  } catch {
    return {
      provider: "lovable",
      status: "down",
      model,
      latency_ms: null,
      error: "сеть/таймаут",
    };
  }
}

/** Проверяет всех провайдеров параллельно и сохраняет результат в БД. */
export async function runHealthCheck(): Promise<ProviderHealth[]> {
  const results = await Promise.all([checkGemini(), checkOpenRouter(), checkLovable()]);
  const checkedAt = new Date().toISOString();
  const rows = results.map((row) => ({ ...row, checked_at: checkedAt }));
  await admin().from("ai_provider_health").upsert(rows, { onConflict: "provider" });
  console.info(
    "[ai-health]",
    rows.map((r) => `${r.provider}=${r.status}${r.model ? `(${r.model})` : ""}`).join(" "),
  );
  return rows as ProviderHealth[];
}

export async function readHealth(): Promise<ProviderHealth[]> {
  const { data } = await admin()
    .from("ai_provider_health")
    .select("provider, status, model, latency_ms, error, checked_at");
  return (data ?? []) as ProviderHealth[];
}

let inFlight: Promise<ProviderHealth[]> | null = null;

/**
 * Возвращает health-статус, перепроверяя провайдеров, если данные устарели.
 * `background: true` — не ждать проверку, отдать текущий снимок сразу.
 */
export async function ensureHealth(background = false): Promise<ProviderHealth[]> {
  const rows = await readHealth();
  const ttl = healthTtlMinutes() * 60 * 1000;
  const freshest = rows.reduce((max, row) => Math.max(max, Date.parse(row.checked_at)), 0);
  const stale = rows.length < 3 || Date.now() - freshest > ttl;
  if (!stale) return rows;

  if (!inFlight) {
    inFlight = runHealthCheck().finally(() => {
      inFlight = null;
    });
  }
  if (background && rows.length) {
    void inFlight.catch(() => {});
    return rows;
  }
  return inFlight;
}

/** Порядок провайдеров: сперва те, что по последней проверке живы. */
export async function healthyFirst(order: ProviderKey[]): Promise<ProviderKey[]> {
  let rows: ProviderHealth[] = [];
  try {
    rows = await ensureHealth(true);
  } catch {
    return order;
  }
  const rank = (p: ProviderKey) => {
    const row = rows.find((r) => r.provider === p);
    if (!row) return 1;
    return row.status === "up" ? 0 : row.status === "unknown" ? 1 : 2;
  };
  return [...order].sort((a, b) => rank(a) - rank(b));
}

export async function markHealth(
  provider: ProviderKey,
  status: HealthStatus,
  model: string | null,
  error: string | null,
) {
  try {
    await admin()
      .from("ai_provider_health")
      .upsert(
        { provider, status, model, error, checked_at: new Date().toISOString() },
        { onConflict: "provider" },
      );
  } catch {
    /* health — вспомогательная информация, не роняем генерацию */
  }
}
