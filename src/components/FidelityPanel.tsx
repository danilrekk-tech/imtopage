import { useState, type RefObject } from "react";
import { Gauge, Loader2, RefreshCw, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { evaluateFidelity, type FidelityReport } from "@/lib/fidelity";

export function FidelityPanel({ sourceUrl, frameRef }: { sourceUrl?: string; frameRef: RefObject<HTMLIFrameElement | null> }) {
  const [report, setReport] = useState<FidelityReport | null>(null);
  const [running, setRunning] = useState(false);

  const run = async () => {
    if (!sourceUrl || !frameRef.current) {
      toast.error("Сначала дождитесь загрузки исходника и превью.");
      return;
    }
    setRunning(true);
    try {
      const next = await evaluateFidelity(sourceUrl, frameRef.current);
      setReport(next);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось оценить соответствие.");
    } finally {
      setRunning(false);
    }
  };

  const score = report?.score ?? 0;
  const tone = score >= 90 ? "text-emerald-400" : score >= 75 ? "text-primary" : score >= 55 ? "text-amber-400" : "text-destructive";

  return (
    <section className="mt-4 rounded-xl border border-border bg-background/30 p-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="rounded-lg border border-primary/20 bg-primary/10 p-2 text-primary"><Gauge className="size-4" /></div>
          <div>
            <p className="flex items-center gap-2 text-sm font-medium">Визуальное соответствие <Sparkles className="size-3.5 text-primary" /></p>
            <p className="mt-1 max-w-xl text-xs text-muted-foreground">Сравнивает исходный скриншот и живое превью, чтобы быстро понять, насколько результат близок к макету.</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {report ? <div className="text-right"><div className={`text-2xl font-bold ${tone}`}>{report.score}%</div><div className="text-[11px] text-muted-foreground">{report.level} точность</div></div> : null}
          <Button variant="secondary" size="sm" onClick={run} disabled={running || !sourceUrl}>
            {running ? <Loader2 className="size-4 animate-spin" /> : report ? <RefreshCw className="size-4" /> : <Gauge className="size-4" />}
            {running ? "Оценка…" : report ? "Пересчитать" : "Оценить результат"}
          </Button>
        </div>
      </div>
      {report ? (
        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          <Metric label="Визуальное сходство" value={report.pixelSimilarity == null ? "—" : `${report.pixelSimilarity}%`} />
          <Metric label="Геометрия" value={`${report.aspectSimilarity}%`} />
          <div className="rounded-lg border border-border/70 bg-card/40 p-3"><p className="text-[11px] text-muted-foreground">Комментарий</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">{report.note}</p></div>
        </div>
      ) : null}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border border-border/70 bg-card/40 p-3"><p className="text-[11px] text-muted-foreground">{label}</p><p className="mt-1 text-sm font-semibold">{value}</p></div>;
}
