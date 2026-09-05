import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Check,
  Copy,
  Download,
  FolderKanban,
  Loader2,
  Plus,
  RefreshCw,
  ScanSearch,
  Sparkles,
  Target,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Disclaimer } from "@/components/Disclaimer";
import { ProviderBadge } from "@/components/ProviderBadge";
import { getDeviceId } from "@/lib/device";
import { prototypeFromReconstruction, reconstructPrompt } from "@/lib/generate.functions";
import { PreviewFrame } from "@/components/PreviewFrame";
import { openHtmlInNewWindow } from "@/lib/preview-window";

import {
  DEFAULT_RECONSTRUCTION_DEPTH,
  DEFAULT_RECONSTRUCTION_TARGET,
  RECONSTRUCTION_DEPTHS,
  RECONSTRUCTION_TARGETS,
  reconstructionFileName,
  type ReconstructionDepth,
  type ReconstructionTarget,
} from "@/lib/reconstruction";

export const Route = createFileRoute("/reconstruct")({
  head: () => ({
    meta: [
      { title: "Точное воспроизведение дизайна — Reconstruction Prompt" },
      {
        name: "description",
        content:
          "Загрузите скриншот сайта и получите точный Reconstruction Prompt для Lovable, Cursor, Claude Code или v0.",
      },
      { property: "og:title", content: "Точное воспроизведение дизайна" },
      {
        property: "og:description",
        content: "Скриншот → подробный Reconstruction Prompt для AI-кодера. Без редизайна и импровизаций.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Reconstruct,
});

type UploadedFile = { dataUrl: string; name: string };

function Reconstruct() {
  const [deviceId, setDeviceId] = useState("");
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [dragging, setDragging] = useState(false);
  const [depth, setDepth] = useState<ReconstructionDepth>(DEFAULT_RECONSTRUCTION_DEPTH);
  const [target, setTarget] = useState<ReconstructionTarget>(DEFAULT_RECONSTRUCTION_TARGET);
  const [note, setNote] = useState("");
  const [active, setActive] = useState(0);
  const [copied, setCopied] = useState(false);
  const [result, setResult] = useState<{ prompt: string; provider?: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => setDeviceId(getDeviceId()), []);

  const run = useServerFn(reconstructPrompt);
  const generate = useMutation({
    mutationFn: async () => {
      if (!files.length) throw new Error("Сначала загрузите скриншот.");
      return run({
        data: { images: files.map((f) => f.dataUrl), deviceId, target, depth, note: note.trim() || undefined },
      });
    },
    onSuccess: (data) => {
      setResult({ prompt: data.prompt, provider: data.provider });
      toast.success("Reconstruction Prompt готов");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const addFiles = useCallback((incoming: File[]) => {
    const valid = incoming.filter((f) => {
      if (!/^image\/(png|jpe?g|webp)$/.test(f.type)) {
        toast.error(`${f.name}: поддерживаются PNG, JPG и WEBP.`);
        return false;
      }
      if (f.size > 10 * 1024 * 1024) {
        toast.error(`${f.name}: файл больше 10 МБ.`);
        return false;
      }
      return true;
    });
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
      setFiles((prev) => [...prev, ...loaded].slice(0, 3));
      setActive(0);
      setResult(null);
    });
  }, []);

  const copyPrompt = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success("Prompt скопирован");
    } catch {
      toast.error("Браузер не дал доступ к буферу обмена");
    }
  };

  const downloadPrompt = () => {
    if (!result) return;
    const blob = new Blob([result.prompt], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = reconstructionFileName(target);
    link.click();
    URL.revokeObjectURL(url);
  };

  const buildProto = useServerFn(prototypeFromReconstruction);
  const build = useMutation({
    mutationFn: async () => {
      if (!result) throw new Error("Сначала сформируйте prompt.");
      return buildProto({
        data: {
          images: files.map((f) => f.dataUrl),
          deviceId,
          prompt: result.prompt,
          fileName: files[0]?.name ?? "reconstruction.png",
        },
      });
    },
    onSuccess: (data) => {
      setProto({ html: data.html, projectId: data.projectId, provider: data.provider });
      toast.success("Прототип собран по Reconstruction Prompt");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const busy = generate.isPending;


  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <div className="sidebar-section">
          <Link to="/" className="sidebar-item">
            <Sparkles className="size-4" /> Новый прототип
          </Link>
          <Link to="/reconstruct" className="sidebar-item sidebar-active">
            <Target className="size-4" /> Точное воспроизведение
          </Link>
          <Link to="/projects" className="sidebar-item">
            <FolderKanban className="size-4" /> Мои проекты
          </Link>
        </div>
        <div className="sidebar-divider" />
        <div className="sidebar-help">
          <div className="sidebar-help-icon">
            <ScanSearch className="size-4" />
          </div>
          <div>
            <p className="text-sm font-semibold">Без редизайна</p>
            <p className="mt-1 text-xs text-muted-foreground">
              AI описывает существующий эталон, а не придумывает новый.
            </p>
          </div>
        </div>
      </aside>

      <main className="app-content">
        <div className="workspace-head">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-semibold">Точное воспроизведение дизайна</h1>
              <span className="status-badge">Reconstruction Prompt</span>
            </div>
            <p className="hidden text-[11px] text-muted-foreground sm:block">
              Скриншот → инструкция для AI-кодера: React + Tailwind + Lucide
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" disabled={!result} onClick={copyPrompt}>
              {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />} Копировать prompt
            </Button>
            <Button size="sm" disabled={!result} onClick={downloadPrompt}>
              <Download className="size-3.5" /> Скачать prompt
            </Button>
          </div>
        </div>

        <section className="workspace-grid">
          <div className="control-card">
            <div className="card-heading">
              <div>
                <span>01</span>
                <h3>Скриншот и режим</h3>
              </div>
              <ScanSearch className="size-4 text-muted-foreground" />
            </div>

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
              onClick={() => !files.length && inputRef.current?.click()}
              className={`upload-zone ${dragging ? "upload-zone-active" : ""} ${files.length ? "upload-zone-filled" : ""}`}
            >
              {files.length ? (
                <div className="upload-filled">
                  <div className="thumb-grid">
                    {files.map((f, i) => (
                      <div key={`${f.name}-${i}`} className="thumb">
                        <img src={f.dataUrl} alt={f.name} />
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setFiles((prev) => prev.filter((_, idx) => idx !== i));
                            setActive(0);
                          }}
                        >
                          <X className="size-3" />
                        </button>
                        <span>{i + 1}</span>
                      </div>
                    ))}
                    {files.length < 3 && (
                      <button
                        className="add-thumb"
                        onClick={(e) => {
                          e.stopPropagation();
                          inputRef.current?.click();
                        }}
                      >
                        <Plus className="size-4" />
                      </button>
                    )}
                  </div>
                  <p className="mt-3 text-xs text-muted-foreground">До 3 экранов · PNG, JPG, WEBP · 10 МБ</p>
                </div>
              ) : (
                <>
                  <div className="upload-icon">
                    <Upload className="size-5" />
                  </div>
                  <p className="mt-3 text-sm font-semibold">Перетащите скриншот сюда</p>
                  <p className="mt-1 text-xs text-muted-foreground">или нажмите для выбора</p>
                </>
              )}
            </div>
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

            <div className="mt-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Режим анализа</p>
              <div className="mt-2 grid gap-1.5">
                {RECONSTRUCTION_DEPTHS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    disabled={busy}
                    onClick={() => setDepth(item.id)}
                    className={`rounded-lg border px-3 py-2.5 text-left transition-all ${depth === item.id ? "border-primary bg-primary/10" : "border-border hover:border-primary/50"}`}
                  >
                    <span className="block text-sm font-medium">{item.label}</span>
                    <span className="block text-xs text-muted-foreground">{item.hint}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Целевая платформа</p>
              <div className="mt-2 grid gap-1.5">
                {RECONSTRUCTION_TARGETS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    disabled={busy}
                    onClick={() => setTarget(item.id)}
                    className={`rounded-lg border px-3 py-2.5 text-left transition-all ${target === item.id ? "border-primary bg-primary/10" : "border-border hover:border-primary/50"}`}
                  >
                    <span className="block text-sm font-medium">{item.label}</span>
                    <span className="block text-xs text-muted-foreground">{item.hint}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Контекст (необязательно)
              </p>
              <Input
                className="mt-2"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Например: это лендинг SaaS, ширина контейнера 1200px"
                disabled={busy}
              />
            </div>

            <Button
              className="primary-action"
              disabled={busy || !deviceId || !files.length}
              onClick={() => generate.mutate()}
            >
              {busy ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Анализирую эталон…
                </>
              ) : (
                <>
                  <Target className="size-4" /> Сформировать prompt
                </>
              )}
            </Button>
            <Disclaimer />
          </div>

          <div className="result-card">
            <div className="result-toolbar">
              <div className="card-heading compact">
                <div>
                  <span>02</span>
                  <h3>Эталон и Reconstruction Prompt</h3>
                </div>
                {result && (
                  <span className="ready-badge">
                    <span /> Готов
                  </span>
                )}
              </div>
            </div>

            {!result ? (
              <div className="empty-preview">
                <div className="empty-orbit">
                  <div className="empty-core">
                    <Target className="size-6" />
                  </div>
                </div>
                <h4>{busy ? "Разбираю визуальный эталон…" : "Prompt появится здесь"}</h4>
                <p>
                  {busy
                    ? "AI фиксирует layout, типографику, цвета и пропорции."
                    : "Загрузите скриншот и выберите целевой AI-кодер."}
                </p>
                <div className="empty-hints">
                  <span>
                    <Check className="size-3" /> 15 разделов
                  </span>
                  <span>
                    <Check className="size-3" /> DO NOT CHANGE
                  </span>
                  <span>
                    <Check className="size-3" /> Visual Fidelity Check
                  </span>
                </div>
              </div>
            ) : (
              <>
                <div className="mt-4 grid gap-4 lg:grid-cols-2">
                  <div className="rounded-xl border border-border bg-secondary/20 p-3">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Исходный screenshot
                    </p>
                    {files[active] ? (
                      <img
                        src={files[active].dataUrl}
                        alt="Исходный скриншот"
                        className="max-h-[70vh] w-full rounded-lg object-contain"
                      />
                    ) : null}
                    {files.length > 1 && (
                      <div className="mt-2 flex gap-1.5">
                        {files.map((f, i) => (
                          <button
                            key={`${f.name}-${i}`}
                            onClick={() => setActive(i)}
                            className={`rounded-md border px-2 py-1 text-xs ${active === i ? "border-primary text-primary" : "border-border text-muted-foreground"}`}
                          >
                            {i + 1}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="rounded-xl border border-border bg-secondary/20 p-3">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Reconstruction Prompt
                    </p>
                    <pre className="max-h-[70vh] overflow-auto whitespace-pre-wrap break-words text-xs leading-relaxed">
                      {result.prompt}
                    </pre>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Button variant="secondary" size="sm" onClick={copyPrompt}>
                    {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />} Копировать prompt
                  </Button>
                  <Button variant="secondary" size="sm" onClick={downloadPrompt}>
                    <Download className="size-3.5" /> Скачать prompt
                  </Button>
                  <Button size="sm" disabled={busy} onClick={() => generate.mutate()}>
                    {busy ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />} Создать
                    prompt заново
                  </Button>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <ProviderBadge used={result.provider} />
                  <span>
                    Цель: {RECONSTRUCTION_TARGETS.find((t) => t.id === target)?.label} · Приоритет: VISUAL FIDELITY &gt;
                    DESIGN INTERPRETATION
                  </span>
                </div>
              </>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
