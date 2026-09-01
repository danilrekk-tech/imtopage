import { useEffect, useMemo, useRef, type RefObject } from "react";
import { toast } from "sonner";

import type { A11yReport } from "@/lib/a11y-audit";
import { withPreviewTools, type PreviewMode } from "@/lib/preview-inject";

type Props = {
  html: string;
  mode: PreviewMode;
  onHtmlChange: (html: string) => void;
  /** Увеличьте значение, чтобы запустить проверку доступности внутри превью. */
  auditRequest?: number;
  onAuditReport?: (report: A11yReport) => void;
  className?: string;
  frameRef?: RefObject<HTMLIFrameElement | null>;
};

export function PreviewFrame({
  html,
  mode,
  onHtmlChange,
  auditRequest = 0,
  onAuditReport,
  className,
  frameRef,
}: Props) {
  const srcDoc = useMemo(() => withPreviewTools(html, mode), [html, mode]);
  const localFrameRef = useRef<HTMLIFrameElement>(null);
  const resolvedFrameRef = frameRef ?? localFrameRef;

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const payload = event.data as
        { __ip?: string; html?: string; report?: A11yReport } | null | undefined;
      if (!payload?.__ip) return;
      if (payload.__ip === "a11y" && payload.report) {
        onAuditReport?.(payload.report);
        return;
      }
      if (typeof payload.html !== "string") return;
      if (payload.__ip === "copy") {
        void navigator.clipboard
          .writeText(payload.html)
          .then(() => toast.success("Код блока скопирован в буфер"))
          .catch(() => toast.error("Браузер не дал доступ к буферу обмена"));
      }
      if (payload.__ip === "html") {
        onHtmlChange(payload.html);
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [onHtmlChange, onAuditReport]);

  useEffect(() => {
    if (!auditRequest) return;
    const timer = setTimeout(() => {
      resolvedFrameRef.current?.contentWindow?.postMessage({ __ip: "a11y_run" }, "*");
    }, 120);
    return () => clearTimeout(timer);
  }, [auditRequest, resolvedFrameRef]);

  return (
    <iframe
      ref={resolvedFrameRef}
      title="Сгенерированная страница"
      srcDoc={srcDoc}
      sandbox="allow-scripts allow-forms allow-popups allow-same-origin"
      className={className ?? "h-[620px] w-full rounded-xl border border-border bg-white"}
    />
  );
}
