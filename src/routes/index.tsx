import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { Download, ExternalLink, Loader2, Sparkles, Upload, Wand2, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Disclaimer } from "@/components/Disclaimer";
import { getDeviceId } from "@/lib/device";
import { editPage, generatePage } from "@/lib/generate.functions";
import { openHtmlInNewWindow } from "@/lib/preview-window";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Image to Interactive Page — скриншот в рабочую страницу" },
      {
        name: "description",
        content:
          "Загрузите скриншот сайта или макет — сервис соберёт визуально близкую HTML-страницу с работающими аккордеонами, табами, слайдерами и формами.",
      },
      { property: "og:title", content: "Image to Interactive Page — скриншот в рабочую страницу" },
      {
        property: "og:description",
        content:
          "Загрузите скриншот сайта или макет — сервис соберёт визуально близкую HTML-страницу с работающими аккордеонами, табами, слайдерами и формами.",
      },
    ],
  }),
  component: Index,
});

const STEPS = [
  "Анализирую макет",
  "Распознаю компоненты",
  "Пишу код",
  "Собираю интерактив",
  "Готово",
];

type ViewMode = "original" | "result" | "split";

function Index() {
  const [deviceId, setDeviceId] = useState("");
  const [file, setFile] = useState<{ dataUrl: string; name: string } | null>(null);
  const [dragging, setDragging] = useState(false);
  const [step, setStep] = useState(0);
  const [result, setResult] = useState<{
    projectId: string;
    html: string;
    analysis: string;
  } | null>(null);
  const [view, setView] = useState<ViewMode>("split");
  const [instruction, setInstruction] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  useEffect(() => setDeviceId(getDeviceId()), []);

  const generateFn = useServerFn(generatePage);
  const editFn = useServerFn(editPage);

  const generate = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("Сначала загрузите изображение.");
      return generateFn({
        data: { imageBase64: file.dataUrl, fileName: file.name, deviceId },
      });
    },
    onSuccess: (data) => {
      setResult(data);
      setStep(STEPS.length - 1);
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      toast.success("Страница готова");
    },
    onError: (error: Error) => {
      setStep(0);
      toast.error(error.message);
    },
  });

  const edit = useMutation({
    mutationFn: async (text: string) => {
      if (!result) throw new Error("Нет проекта для правки.");
      return editFn({ data: { projectId: result.projectId, instruction: text, deviceId } });
    },
    onSuccess: (data, text) => {
      setResult((prev) => (prev ? { ...prev, html: data.html, analysis: data.analysis } : prev));
      setHistory((prev) => [...prev, text]);
      setInstruction("");
      toast.success("Правка внесена");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  useEffect(() => {
    if (!generate.isPending) return;
    setStep(0);
    const timer = setInterval(() => {
      setStep((prev) => (prev < STEPS.length - 2 ? prev + 1 : prev));
    }, 6000);
    return () => clearInterval(timer);
  }, [generate.isPending]);

  const readFile = useCallback((f: File) => {
    if (!/^image\/(png|jpe?g|webp)$/.test(f.type)) {
      toast.error("Поддерживаются PNG, JPG и WEBP.");
      return;
    }
    if (f.size > 10 * 1024 * 1024) {
      toast.error("Файл больше 10 МБ.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setFile({ dataUrl: String(reader.result), name: f.name });
      setResult(null);
      setHistory([]);
    };
    reader.readAsDataURL(f);
  }, []);

  const download = () => {
    if (!result) return;
    const blob = new Blob([result.html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "interactive-page.html";
    link.click();
    URL.revokeObjectURL(url);
  };

  const openInNewWindow = () => {
    if (!result) return;
    try {
      openHtmlInNewWindow(result.html);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось открыть окно");
    }
  };

  const busy = generate.isPending;

  return (
    <main className="mx-auto max-w-7xl px-4 pb-24 pt-12">
      <section className="mx-auto max-w-3xl text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs text-muted-foreground">
          <Sparkles className="size-3.5 text-primary" />
          Скриншот → живая страница
        </span>
        <h1 className="mt-5 text-4xl font-bold sm:text-5xl">
          Превратите картинку в <span className="text-primary">рабочую интерактивную страницу</span>
        </h1>
        <p className="mt-4 text-base text-muted-foreground">
          Загрузите скриншот сайта или дизайн-макет. Сервис распознаёт блоки, палитру и компоненты,
          а затем собирает самодостаточный HTML с реально работающими аккордеонами, табами,
          слайдерами и формами.
        </p>
      </section>

      <section className="mt-10 grid gap-6 lg:grid-cols-[minmax(0,380px)_1fr]">
        <div className="panel p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            1. Загрузка
          </h2>

          {file ? (
            <div className="mt-4 space-y-4">
              <div className="relative overflow-hidden rounded-xl border border-border">
                <img src={file.dataUrl} alt="Загруженный скриншот" className="w-full" />
                <button
                  onClick={() => {
                    setFile(null);
                    setResult(null);
                  }}
                  className="absolute right-2 top-2 rounded-md bg-background/80 p-1.5 text-foreground transition-colors hover:bg-background"
                  aria-label="Убрать изображение"
                >
                  <X className="size-4" />
                </button>
              </div>
              <p className="truncate text-xs text-muted-foreground">{file.name}</p>
              <Button
                className="w-full"
                disabled={busy || !deviceId}
                onClick={() => generate.mutate()}
              >
                {busy ? (
                  <>
                    <Loader2 className="size-4 animate-spin" /> Генерирую…
                  </>
                ) : (
                  <>
                    <Wand2 className="size-4" /> Сгенерировать интерактивную страницу
                  </>
                )}
              </Button>
            </div>
          ) : (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                const dropped = e.dataTransfer.files?.[0];
                if (dropped) readFile(dropped);
              }}
              onClick={() => inputRef.current?.click()}
              className={`mt-4 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-14 text-center transition-colors ${
                dragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/60"
              }`}
            >
              <Upload className="size-6 text-primary" />
              <p className="mt-3 text-sm font-medium">Перетащите PNG или JPG</p>
              <p className="mt-1 text-xs text-muted-foreground">
                или нажмите, чтобы выбрать · до 10 МБ
              </p>
              <input
                ref={inputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(e) => {
                  const picked = e.target.files?.[0];
                  if (picked) readFile(picked);
                }}
              />
            </div>
          )}

          {(busy || result) && (
            <div className="mt-6 space-y-3">
              <Progress value={((step + (result ? 1 : 0)) / STEPS.length) * 100} />
              <ul className="space-y-1.5 text-xs">
                {STEPS.map((label, index) => {
                  const done = result ? true : index < step;
                  const active = !result && index === step;
                  return (
                    <li
                      key={label}
                      className={
                        done
                          ? "text-primary"
                          : active
                            ? "text-foreground"
                            : "text-muted-foreground/60"
                      }
                    >
                      {done ? "✓" : active ? "…" : "•"} {label}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          <Disclaimer className="mt-6" />
        </div>

        <div className="panel min-h-[520px] p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              2. Результат
            </h2>
            {result ? (
              <div className="flex items-center gap-2">
                <div className="flex rounded-lg border border-border p-0.5 text-xs">
                  {(
                    [
                      ["original", "Оригинал"],
                      ["result", "Результат"],
                      ["split", "Рядом"],
                    ] as [ViewMode, string][]
                  ).map(([mode, label]) => (
                    <button
                      key={mode}
                      onClick={() => setView(mode)}
                      className={`rounded-md px-3 py-1.5 transition-colors ${
                        view === mode
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <Button variant="secondary" size="sm" onClick={openInNewWindow}>
                  <ExternalLink className="size-4" /> Открыть в новом окне
                </Button>
                <Button variant="secondary" size="sm" onClick={download}>
                  <Download className="size-4" /> Скачать код
                </Button>
              </div>
            ) : null}
          </div>

          {!result ? (
            <div className="mt-10 flex h-[420px] flex-col items-center justify-center rounded-xl border border-dashed border-border text-center text-sm text-muted-foreground">
              {busy ? (
                <>
                  <Loader2 className="size-6 animate-spin text-primary" />
                  <p className="mt-3">{STEPS[step]}…</p>
                </>
              ) : (
                <p>Здесь появится живое превью сгенерированной страницы</p>
              )}
            </div>
          ) : (
            <>
              <div
                className={`mt-4 grid gap-4 ${view === "split" ? "md:grid-cols-2" : "grid-cols-1"}`}
              >
                {view !== "result" && file ? (
                  <div className="overflow-auto rounded-xl border border-border bg-background/40 p-2">
                    <img src={file.dataUrl} alt="Оригинал" className="w-full rounded-lg" />
                  </div>
                ) : null}
                {view !== "original" ? (
                  <iframe
                    title="Сгенерированная страница"
                    srcDoc={result.html}
                    sandbox="allow-scripts allow-forms allow-popups"
                    className="h-[560px] w-full rounded-xl border border-border bg-white"
                  />
                ) : null}
              </div>

              {result.analysis ? (
                <details className="mt-4 rounded-xl border border-border p-4 text-sm">
                  <summary className="cursor-pointer text-muted-foreground">
                    Что распознано на макете
                  </summary>
                  <pre className="mt-3 whitespace-pre-wrap text-xs text-muted-foreground">
                    {result.analysis}
                  </pre>
                </details>
              ) : null}

              <div className="mt-4 rounded-xl border border-border p-4">
                <p className="text-sm font-medium">Редактировать текстом</p>
                {history.length ? (
                  <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                    {history.map((item, index) => (
                      <li key={`${item}-${index}`}>→ {item}</li>
                    ))}
                  </ul>
                ) : null}
                <form
                  className="mt-3 flex gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (instruction.trim().length > 1) edit.mutate(instruction.trim());
                  }}
                >
                  <Input
                    value={instruction}
                    onChange={(e) => setInstruction(e.target.value)}
                    placeholder="Например: сделай кнопку «Получить расчёт» розовой"
                    disabled={edit.isPending}
                  />
                  <Button type="submit" disabled={edit.isPending || instruction.trim().length < 2}>
                    {edit.isPending ? <Loader2 className="size-4 animate-spin" /> : "Применить"}
                  </Button>
                </form>
              </div>

              <p className="mt-3 text-xs text-muted-foreground">
                Проект сохранён —{" "}
                <Link to="/projects" className="text-primary hover:underline">
                  открыть мои проекты
                </Link>
              </p>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
