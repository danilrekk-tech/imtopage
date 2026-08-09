import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Activity, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getProviderHealth } from "@/lib/health.functions";

const LABELS: Record<string, string> = {
  gemini: "Gemini",
  openrouter: "OpenRouter",
  lovable: "Lovable AI",
};

const USED_LABELS: Record<string, string> = {
  gemini: "Gemini",
  openrouter_fallback: "OpenRouter",
  lovable_fallback: "Lovable AI",
  cache: "Кеш",
};

function dot(status: string) {
  return status === "up" ? "bg-emerald-500" : status === "down" ? "bg-red-500" : "bg-amber-500";
}

/** Показывает, какой провайдер сгенерировал текущую версию, и health-статус всех провайдеров. */
export function ProviderBadge({ used }: { used?: string | undefined }) {
  const fetchHealth = useServerFn(getProviderHealth);
  const query = useQuery({
    queryKey: ["provider-health"],
    queryFn: () => fetchHealth({ data: { force: false } }),
    refetchInterval: 5 * 60 * 1000,
    staleTime: 60 * 1000,
  });

  const providers = query.data?.providers ?? [];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="secondary" size="sm" title="AI-провайдер и его статус">
          <Activity className="size-4" />
          {used ? (USED_LABELS[used] ?? used) : "AI-провайдер"}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72 p-3 text-xs">
        <p className="mb-2 text-sm font-medium">
          Последняя генерация: {used ? (USED_LABELS[used] ?? used) : "—"}
        </p>
        <ul className="space-y-1.5">
          {providers.length ? (
            providers.map((p) => (
              <li key={p.provider} className="flex items-start justify-between gap-2">
                <span className="flex items-center gap-2">
                  <span className={`size-2 rounded-full ${dot(p.status)}`} />
                  {LABELS[p.provider] ?? p.provider}
                </span>
                <span className="max-w-[9rem] truncate text-right text-muted-foreground">
                  {p.status === "up"
                    ? `${p.model ?? "ok"}${p.latency_ms ? ` · ${p.latency_ms} мс` : ""}`
                    : (p.error ?? "нет данных")}
                </span>
              </li>
            ))
          ) : (
            <li className="text-muted-foreground">Проверяю доступность…</li>
          )}
        </ul>
        <Button
          variant="ghost"
          size="sm"
          className="mt-3 w-full"
          disabled={query.isFetching}
          onClick={() => {
            void fetchHealth({ data: { force: true } }).then(() => query.refetch());
          }}
        >
          <RefreshCw className={`size-3.5 ${query.isFetching ? "animate-spin" : ""}`} /> Проверить
          сейчас
        </Button>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
