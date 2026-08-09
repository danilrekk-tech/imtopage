import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/** Health-статус AI-провайдеров. Перепроверяется в фоне раз в N минут. */
export const getProviderHealth = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ force: z.boolean().default(false) }).parse(input ?? {}),
  )
  .handler(async ({ data }) => {
    const { ensureHealth, runHealthCheck, healthTtlMinutes } = await import("./health.server");
    const providers = data.force ? await runHealthCheck() : await ensureHealth();
    return { providers, ttlMinutes: healthTtlMinutes() };
  });
