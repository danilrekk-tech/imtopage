import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Code2,
  Copy,
  Download,
  ExternalLink,
  FileArchive,
  Loader2,
  MousePointerClick,
  Sparkles,
  SplitSquareHorizontal,
  Upload,
  Wand2,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Disclaimer } from "@/components/Disclaimer";
import { CompareSlider } from "@/components/CompareSlider";
import { GenerationOptionsPanel } from "@/components/GenerationOptionsPanel";
import { PreviewFrame } from "@/components/PreviewFrame";
import { getDeviceId } from "@/lib/device";
import { editPage, generatePage } from "@/lib/generate.functions";
import { DEFAULT_OPTIONS, type GenerationOptions } from "@/lib/generation-options";
import { downloadHtml, downloadZip, openInCodeSandbox } from "@/lib/export-tools";
import type { PreviewMode } from "@/lib/preview-inject";
import { openHtmlInNewWindow } from "@/lib/preview-window";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Image to Interactive Page — скриншот в рабочий прототип" },
      {
        name: "description",
        content:
          "Загрузите до трёх скриншотов — сервис соберёт интерактивный прототип на HTML, React или Vue с рабочими компонентами, темами, инспектором и экспортом в ZIP или CodeSandbox.",
      },
      { property: "og:title", content: "Image to Interactive Page — скриншот в рабочий прототип" },
      {
        property: "og:description",
        content:
          "Скриншот превращается в рабочий прототип: выбор стека, дизайн-токены, сравнение с оригиналом, инспектор и экспорт кода.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
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

type ViewMode = "result" | "split" | "compare";
type UploadedFile = { dataUrl: string; name: string };

function Index() {
  const [deviceId, setDeviceId] = useState("");
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [options, setOptions] = useState<GenerationOptions>(DEFAULT_OPTIONS);
  const [dragging, setDragging] = useState(false);
  const [step, setStep] = useState(0);
  const [result, setResult] = useState<{
    projectId: string;
    html: string;
    analysis: string;
  } | null>(null);
  const [view, setView] = useState<ViewMode>("split");
  const [previewMode, setPreviewMode] = useState<PreviewMode>("off");
  const [instruction, setInstruction] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  useEffect(() => setDeviceId(getDeviceId()), []);

  const generateFn = useServerFn(generatePage);
  const editFn = useServerFn(editPage);

  const generate = useMutation({
    mutationFn: async () => {
      if (!files.length) throw new Error("Сначала загрузите изображение.");
      return generateFn({
        data: {
          images: files.map((f) => f.dataUrl),
          fileName: files[0]!.name,
          deviceId,
          options,
        },
      });
    },
    onSuccess: (data) => {
      setResult(data);
      setStep(STEPS.length - 1);
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      toast.success("Прототип готов");
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

  const addFiles = useCallback((incoming: File[]) => {
    const valid: File[] = [];
    for (const f of incoming) {
      if (!/^image\/(png|jpe?g|webp)$/.test(f.type)) {
        toast.error(`${f.name}: поддерживаются PNG, JPG и WEBP.`);
        continue;
      }
      if (f.size > 10 * 1024 * 1024) {
        toast.error(`${f.name}: файл больше 10 МБ.`);
        continue;
      }
      valid.push(f);
    }
    if (!valid.length) return;

    Promise.all(
      valid.map(
        (f) =>
          new Promise<UploadedFile>((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve({ dataUrl: String(reader.result), name: f.name });
            reader.readAsDataURL(f);
          }),
      ),
    ).then((loaded) => {
      setFiles((prev) => {
        const next = [...prev, ...loaded].slice(0, 3);
        if (prev.length + loaded.length > 3) toast.info("Можно загрузить максимум 3 экрана.");
        return next;
      });
      setResult(null);
      setHistory([]);
    });
  }, []);

  const openInNewWindow = () => {
    if (!result) return;
    try {
      openHtmlInNewWindow(result.html);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось открыть окно");
    }
  };

  const copyAll = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.html);
      toast.success("Весь код скопирован");
    } catch {
      toast.error("Браузер не дал доступ к буферу обмена");
    }
  };

  const busy = generate.isPending;
  const title = files[0]?.name.replace(/\.[^.]+$/, "") ?? "prototype";

  return (
    <main className="mx-auto max-w-7xl px-4 pb-24 pt-12">
      <section className="max-w-3xl">
        <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs text-muted-foreground">
          <Sparkles className="size-3.5 text-primary" />
          Скриншот → рабочий прототип
        </span>
        <h1 className="mt-5 text-4xl font-bold sm:text-5xl">
          Превратите макет в{" "}
          <span className="text-primary">интерактивный прототип на вашем стеке</span>
        </h1>
        <p className="mt-4 max-w-[65ch] text-base leading-relaxed text-muted-foreground">
          Загрузите до трёх экранов, выберите стек и дизайн-токены. Сервис соберёт связанный
          прототип с рабочими компонентами, переключателем тем, инспектором элементов и экспортом
          кода.
        </p>
      </section>

      <section className="mt-10 grid gap-6 lg:grid-cols-[minmax(0,380px)_1fr]">
        <div className="panel space-y-5 p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            1. Загрузка · до 3 экранов
          </h2>

          {files.length ? (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2">
                {files.map((f, index) => (
                  <div
                    key={`${f.name}-${index}`}
                    className="group relative overflow-hidden rounded-lg border border-border"
                  >
                    <img src={f.dataUrl} alt={f.name} className="h-20 w-full object-cover" />
                    <span className="absolute left-1 top-1 rounded bg-background/80 px-1 font-mono text-[10px]">
                      {index + 1}
                    </span>
                    <button
                      onClick={() => setFiles((prev) => prev.filter((_, i) => i !== index))}
                      className="absolute right-1 top-1 rounded bg-background/80 p-1 opacity-0 transition-opacity group-hover:opacity-100"
                      aria-label={`Убрать ${f.name}`}
                    >
                      <X className="size-3" />
                    </button>
                  </div>
                ))}
                {files.length < 3 ? (
                  <button
                    onClick={() => inputRef.current?.click()}
                    className="flex h-20 items-center justify-center rounded-lg border border-dashed border-border text-xs text-muted-foreground transition-colors hover:border-primary/60"
                  >
                    + экран
                  </button>
                ) : null}
              </div>
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
                addFiles(Array.from(e.dataTransfer.files ?? []));
              }}
              onClick={() => inputRef.current?.click()}
              className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-12 text-center transition-colors ${
                dragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/60"
              }`}
            >
              <Upload className="size-6 text-primary" />
              <p className="mt-3 text-sm font-medium">Перетащите до 3 изображений</p>
              <p className="mt-1 text-xs text-muted-foreground">PNG, JPG, WEBP · до 10 МБ каждое</p>
            </div>
          )}

          <input
            ref={inputRef}
            type="file"
            multiple
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => {
              addFiles(Array.from(e.target.files ?? []));
              e.target.value = "";
            }}
          />

          <GenerationOptionsPanel value={options} onChange={setOptions} disabled={busy} />

          <Button
            className="w-full transition-transform active:translate-y-px"
            disabled={busy || !deviceId || !files.length}
            onClick={() => generate.mutate()}
          >
            {busy ? (
              <>
                <Loader2 className="size-4 animate-spin" /> Генерирую…
              </>
            ) : (
              <>
                <Wand2 className="size-4" /> Собрать прототип
              </>
            )}
          </Button>

          {(busy || result) && (
            <div className="space-y-3">
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

          <Disclaimer />
        </div>

        <div className="panel min-h-[560px] p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              2. Результат
            </h2>
            {result ? (
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex rounded-lg border border-border p-0.5 text-xs">
                  {(
                    [
                      ["result", "Результат"],
                      ["split", "Рядом"],
                      ["compare", "Сравнить с оригиналом"],
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
                      {mode === "compare" ? (
                        <span className="flex items-center gap-1.5">
                          <SplitSquareHorizontal className="size-3.5" /> {label}
                        </span>
                      ) : (
                        label
                      )}
                    </button>
                  ))}
                </div>

                <div className="flex rounded-lg border border-border p-0.5 text-xs">
                  {(
                    [
                      ["off", "Просмотр"],
                      ["inspect", "Инспектор"],
                      ["copy", "Копировать блок"],
                    ] as [PreviewMode, string][]
                  ).map(([mode, label]) => (
                    <button
                      key={mode}
                      onClick={() => {
                        setPreviewMode(mode);
                        if (mode !== "off") setView("result");
                      }}
                      className={`rounded-md px-3 py-1.5 transition-colors ${
                        previewMode === mode
                          ? "bg-secondary text-foreground"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <span className="flex items-center gap-1.5">
                        {mode === "inspect" ? <MousePointerClick className="size-3.5" /> : null}
                        {mode === "copy" ? <Copy className="size-3.5" /> : null}
                        {label}
                      </span>
                    </button>
                  ))}
                </div>

                <Button variant="secondary" size="sm" onClick={openInNewWindow}>
                  <ExternalLink className="size-4" /> В новом окне
                </Button>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="secondary" size="sm">
                      <Download className="size-4" /> Экспорт
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-60">
                    <DropdownMenuItem
                      onClick={() => downloadZip(result.html, options.framework, title)}
                    >
                      <FileArchive className="size-4" /> Скачать ZIP
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => downloadHtml(result.html, title)}>
                      <Download className="size-4" /> Скачать HTML
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={copyAll}>
                      <Copy className="size-4" /> Копировать весь код
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => {
                        setPreviewMode("copy");
                        setView("result");
                        toast.info("Наведите на блок в превью и кликните — код скопируется");
                      }}
                    >
                      <MousePointerClick className="size-4" /> Копировать компонент
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => openInCodeSandbox(result.html)}>
                      <Code2 className="size-4" /> Открыть в CodeSandbox
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
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
                <p>Здесь появится живое превью собранного прототипа</p>
              )}
            </div>
          ) : (
            <>
              {view === "compare" && files[0] ? (
                <div className="mt-4">
                  <CompareSlider originalSrc={files[0].dataUrl} html={result.html} />
                </div>
              ) : (
                <div
                  className={`mt-4 grid gap-4 ${view === "split" ? "md:grid-cols-2" : "grid-cols-1"}`}
                >
                  {view === "split" && files[0] ? (
                    <div className="max-h-[620px] overflow-auto rounded-xl border border-border bg-background/40 p-2">
                      {files.map((f, index) => (
                        <img
                          key={`${f.name}-${index}`}
                          src={f.dataUrl}
                          alt={`Оригинал ${index + 1}`}
                          className="mb-2 w-full rounded-lg"
                        />
                      ))}
                    </div>
                  ) : null}
                  <PreviewFrame
                    html={result.html}
                    mode={previewMode}
                    onHtmlChange={(html) => setResult((prev) => (prev ? { ...prev, html } : prev))}
                  />
                </div>
              )}

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
                <p className="text-sm font-medium">Запросить правки к этой версии</p>
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
                    placeholder="Например: сделай хедер sticky, кнопки — изумрудными"
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
