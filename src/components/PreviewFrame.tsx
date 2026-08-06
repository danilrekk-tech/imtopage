import { useEffect, useMemo } from "react";
import { toast } from "sonner";

import { withPreviewTools, type PreviewMode } from "@/lib/preview-inject";

type Props = {
  html: string;
  mode: PreviewMode;
  onHtmlChange: (html: string) => void;
  className?: string;
};

export function PreviewFrame({ html, mode, onHtmlChange, className }: Props) {
  const srcDoc = useMemo(() => withPreviewTools(html, mode), [html, mode]);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const payload = event.data as { __ip?: string; html?: string } | null;
      if (!payload?.__ip || typeof payload.html !== "string") return;
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
  }, [onHtmlChange]);

  return (
    <iframe
      title="Сгенерированная страница"
      srcDoc={srcDoc}
      sandbox="allow-scripts allow-forms allow-popups"
      className={className ?? "h-[620px] w-full rounded-xl border border-border bg-white"}
    />
  );
}
