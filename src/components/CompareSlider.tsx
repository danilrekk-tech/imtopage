import { useRef, useState } from "react";

type Props = {
  originalSrc: string;
  html: string;
};

/** Наложение оригинального скриншота поверх отрендеренного превью со шторкой. */
export function CompareSlider({ originalSrc, html }: Props) {
  const [position, setPosition] = useState(50);
  const containerRef = useRef<HTMLDivElement>(null);

  return (
    <div className="space-y-2">
      <div
        ref={containerRef}
        className="relative h-[620px] w-full overflow-hidden rounded-xl border border-border bg-white"
      >
        <iframe
          title="Результат для сравнения"
          srcDoc={html}
          sandbox="allow-scripts allow-forms allow-popups"
          className="absolute inset-0 size-full"
        />
        <div
          className="pointer-events-none absolute inset-0 overflow-hidden"
          style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}
        >
          <img
            src={originalSrc}
            alt="Оригинальный скриншот"
            className="w-full opacity-95"
            style={{ imageRendering: "auto" }}
          />
        </div>
        <div
          className="pointer-events-none absolute inset-y-0 w-px bg-primary"
          style={{ left: `${position}%` }}
        >
          <span className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-primary bg-background px-2 py-1 font-mono text-[10px] text-primary">
            {Math.round(position)}%
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          step={0.5}
          value={position}
          aria-label="Позиция шторки сравнения"
          onChange={(e) => setPosition(Number(e.target.value))}
          className="absolute inset-x-0 bottom-0 z-10 w-full cursor-ew-resize opacity-0"
          style={{ height: "100%" }}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        Слева — оригинальный скриншот, справа — живая страница. Тяните мышью по полю, чтобы сверить
        сетку и отступы.
      </p>
    </div>
  );
}
