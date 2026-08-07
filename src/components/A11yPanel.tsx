import { AlertTriangle, CheckCircle2, Info, Loader2, ScanLine, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { A11yReport, A11ySeverity } from "@/lib/a11y-audit";

const META: Record<A11ySeverity, { label: string; className: string; Icon: typeof Info }> = {
  critical: { label: "Критично", className: "text-destructive", Icon: XCircle },
  warning: { label: "Важно", className: "text-primary", Icon: AlertTriangle },
  info: { label: "Совет", className: "text-muted-foreground", Icon: Info },
};

type Props = {
  report: A11yReport | null;
  running: boolean;
  onRun: () => void;
};

export function A11yPanel({ report, running, onRun }: Props) {
  return (
    <section className="mt-4 rounded-xl border border-border p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">Проверка доступности перед экспортом</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Контраст, alt-тексты, семантика, фокус для клавиатуры.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {report ? (
            <span
              className={`text-sm font-semibold ${
                report.score >= 90
                  ? "text-primary"
                  : report.score >= 70
                    ? "text-foreground"
                    : "text-destructive"
              }`}
            >
              {report.score}/100
            </span>
          ) : null}
          <Button variant="secondary" size="sm" onClick={onRun} disabled={running}>
            {running ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <ScanLine className="size-4" />
            )}
            Проверить доступность
          </Button>
        </div>
      </div>

      {report ? (
        report.issues.length ? (
          <ul className="mt-4 space-y-3">
            {report.issues.map((issue) => {
              const meta = META[issue.severity];
              return (
                <li key={issue.id} className="rounded-lg border border-border/70 p-3">
                  <div className="flex items-start gap-2">
                    <meta.Icon className={`mt-0.5 size-4 shrink-0 ${meta.className}`} />
                    <div className="min-w-0">
                      <p className="text-sm font-medium">
                        {issue.title}{" "}
                        <span className="text-xs font-normal text-muted-foreground">
                          · {meta.label} · {issue.count}
                        </span>
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">{issue.hint}</p>
                      {issue.samples.length ? (
                        <ul className="mt-2 space-y-0.5">
                          {issue.samples.map((sample, index) => (
                            <li
                              key={`${issue.id}-${index}`}
                              className="truncate font-mono text-[11px] text-muted-foreground/80"
                            >
                              {sample}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mt-4 flex items-center gap-2 text-sm text-primary">
            <CheckCircle2 className="size-4" /> Проблем не найдено — страницу можно экспортировать.
          </p>
        )
      ) : (
        <p className="mt-3 text-xs text-muted-foreground/80">
          Запустите проверку, чтобы получить список рекомендаций по правкам.
        </p>
      )}
    </section>
  );
}
