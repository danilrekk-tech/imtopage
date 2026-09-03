import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Activity,
  ArrowUpRight,
  Check,
  Code2,
  Copy,
  Download,
  ExternalLink,
  FileArchive,
  FolderKanban,
  History,
  LayoutTemplate,
  Loader2,
  MousePointerClick,
  Palette,
  PanelLeft,
  Plus,
  Rocket,
  Settings2,
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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Disclaimer } from "@/components/Disclaimer";
import { CompareSlider } from "@/components/CompareSlider";
import { GenerationOptionsPanel } from "@/components/GenerationOptionsPanel";
import { PreviewFrame } from "@/components/PreviewFrame";
import { A11yPanel } from "@/components/A11yPanel";
import { ProviderBadge } from "@/components/ProviderBadge";
import { ShareDialog } from "@/components/ShareDialog";
import { getDeviceId } from "@/lib/device";
import { editPage, generatePage } from "@/lib/generate.functions";
import { DEFAULT_OPTIONS, DESIGN_TEMPLATES, FRAMEWORKS, type GenerationOptions } from "@/lib/generation-options";
import { downloadHtml, downloadZip, openInCodeSandbox } from "@/lib/export-tools";

import type { A11yReport } from "@/lib/a11y-audit";
import type { PreviewMode } from "@/lib/preview-inject";
import { openHtmlInNewWindow } from "@/lib/preview-window";
import heroVisual from "@/assets/hero-visual.png.asset.json";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Image to Interactive — AI-прототипы из скриншотов" },
      { name: "description", content: "Превращайте скриншоты и макеты в живые интерактивные прототипы." },
    ],
  }),
  component: Index,
});

const STEPS = ["Анализирую макет", "Распознаю компоненты", "Пишу код", "Собираю интерактив", "Готово"];
type ViewMode = "result" | "split" | "compare";
type UploadedFile = { dataUrl: string; name: string };

function Index() {
  const [deviceId, setDeviceId] = useState("");
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [options, setOptions] = useState<GenerationOptions>(DEFAULT_OPTIONS);
  const [dragging, setDragging] = useState(false);
  const [step, setStep] = useState(0);
  const [result, setResult] = useState<{ projectId: string; html: string; analysis: string; provider?: string } | null>(null);
  const [view, setView] = useState<ViewMode>("result");
  const [previewMode, setPreviewMode] = useState<PreviewMode>("off");
  const [a11yReport, setA11yReport] = useState<A11yReport | null>(null);
  const [auditRunning, setAuditRunning] = useState(false);
  const [auditRequest, setAuditRequest] = useState(0);
  const [instruction, setInstruction] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const optionsRef = useRef<HTMLDivElement>(null);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  const queryClient = useQueryClient();
  useEffect(() => setDeviceId(getDeviceId()), []);
  useEffect(() => {
    try {
      const draft = localStorage.getItem("imtopage-token-draft");
      if (draft) setOptions((current) => ({ ...current, ...JSON.parse(draft) }));
    } catch {
      // Ignore invalid local token drafts.
    }
  }, []);

  const generateFn = useServerFn(generatePage);
  const editFn = useServerFn(editPage);

  const generate = useMutation({
    mutationFn: async () => {
      if (!files.length) throw new Error("Сначала загрузите изображение.");
      return generateFn({ data: { images: files.map((f) => f.dataUrl), fileName: files[0]!.name, deviceId, options } });
    },
    onSuccess: (data) => {
      setResult(data);
      setA11yReport(null);
      setStep(STEPS.length - 1);
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      toast.success("Прототип готов");
    },
    onError: (error: Error) => { setStep(0); toast.error(error.message); },
  });

  const edit = useMutation({
    mutationFn: async (text: string) => {
      if (!result) throw new Error("Нет проекта для правки.");
      return editFn({ data: { projectId: result.projectId, instruction: text, deviceId } });
    },
    onSuccess: (data, text) => {
      setResult((prev) => prev ? { ...prev, html: data.html, analysis: data.analysis, provider: data.provider } : prev);
      setHistory((prev) => [...prev, text]);
      setInstruction("");
      toast.success("Правка внесена");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  useEffect(() => {
    if (!generate.isPending) return;
    setStep(0);
    const timer = setInterval(() => setStep((prev) => prev < STEPS.length - 2 ? prev + 1 : prev), 6000);
    return () => clearInterval(timer);
  }, [generate.isPending]);

  const addFiles = useCallback((incoming: File[]) => {
    const valid: File[] = [];
    for (const f of incoming) {
      if (!/^image\/(png|jpe?g|webp)$/.test(f.type)) { toast.error(`${f.name}: поддерживаются PNG, JPG и WEBP.`); continue; }
      if (f.size > 10 * 1024 * 1024) { toast.error(`${f.name}: файл больше 10 МБ.`); continue; }
      valid.push(f);
    }
    if (!valid.length) return;
    Promise.all(valid.map((f) => new Promise<UploadedFile>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve({ dataUrl: String(reader.result), name: f.name });
      reader.readAsDataURL(f);
    }))).then((loaded) => {
      setFiles((prev) => [...prev, ...loaded].slice(0, 3));
      setResult(null); setHistory([]);
    });
  }, []);

  const openInNewWindow = () => {
    if (!result) return;
    try { openHtmlInNewWindow(result.html); } catch (error) { toast.error(error instanceof Error ? error.message : "Не удалось открыть окно"); }
  };
  const copyAll = async () => {
    if (!result) return;
    try { await navigator.clipboard.writeText(result.html); toast.success("Весь код скопирован"); }
    catch { toast.error("Браузер не дал доступ к буферу обмена"); }
  };
  const scrollToTokens = () => {
    optionsRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    toast.info("Дизайн-токены — в панели настроек слева");
  };
  const applyTemplate = (id: string) => {
    const template = DESIGN_TEMPLATES.find((t) => t.id === id);
    if (!template) return;
    const next = { ...options, ...template.options };
    setOptions(next);
    try { localStorage.setItem("imtopage-token-draft", JSON.stringify(template.options)); } catch { /* storage may be blocked */ }
    setTemplatesOpen(false);
    toast.success(`Шаблон «${template.name}» применён`);
  };
  const exportCode = () => {
    if (!result) { toast.error("Сначала сгенерируйте прототип"); return; }
    downloadZip(result.html, options.framework, title);
  };


  const busy = generate.isPending;
  const title = files[0]?.name.replace(/\.[^.]+$/, "") ?? "prototype";

  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <div className="sidebar-section">
          <Link to="/" className="sidebar-item sidebar-active"><Sparkles className="size-4" /> Новый прототип</Link>
          <Link to="/projects" className="sidebar-item"><FolderKanban className="size-4" /> Мои проекты</Link>
          <button className="sidebar-item" onClick={() => setTemplatesOpen(true)}><LayoutTemplate className="size-4" /> Шаблоны дизайна</button>
          <button className="sidebar-item" onClick={scrollToTokens}><Palette className="size-4" /> Дизайн-токены</button>
          <Link to="/projects" className="sidebar-item"><History className="size-4" /> История генераций</Link>
          <button className="sidebar-item" onClick={exportCode}><Download className="size-4" /> Экспорт кода</button>
          <button className="sidebar-item" onClick={() => setSettingsOpen(true)}><Settings2 className="size-4" /> Настройки</button>

        </div>
        <div className="sidebar-divider" />
        <div className="sidebar-help">
          <div className="sidebar-help-icon"><Rocket className="size-4" /></div>
          <div><p className="text-sm font-semibold">Как это работает?</p><p className="mt-1 text-xs text-muted-foreground">Загрузите макет — получите код.</p></div>
          <button className="sidebar-help-button" onClick={() => setHelpOpen(true)}>Посмотреть</button>
        </div>
        <div className="sidebar-user"><div className="avatar">IP</div><div className="min-w-0"><p className="truncate text-xs font-semibold">Ваш проект</p><p className="truncate text-[11px] text-muted-foreground">Рабочее пространство</p></div></div>
      </aside>

      <main className="app-content">
        <div className="workspace-head">
          <div className="flex min-w-0 items-center gap-3"><div><div className="flex items-center gap-2"><h1 className="text-sm font-semibold">Новый прототип</h1><span className="status-badge">Черновик</span></div><p className="hidden text-[11px] text-muted-foreground sm:block">Скриншот → интерактивная страница</p></div></div>
          <div className="flex items-center gap-2"><Button variant="secondary" size="sm" disabled={!result} onClick={openInNewWindow}><ExternalLink className="size-3.5" /> Предпросмотр</Button><Button size="sm" disabled={!result} onClick={() => result && downloadZip(result.html, options.framework, title)}><Download className="size-3.5" /> Экспорт</Button></div>
        </div>

        <section className="hero-grid">
          <div className="hero-copy">
            <div className="eyebrow"><Sparkles className="size-3.5" /> AI WORKSPACE</div>
            <h2>Превратите макет в<br /><span>интерактивный прототип</span></h2>
            <p>Загрузите макет, выберите технологии, настройте параметры и получите живую страницу, готовую к передаче разработчику.</p>
          </div>
          <div className="hero-visual-wrap"><img src={heroVisual.url} alt="Графика Image to Interactive" className="hero-visual" /></div>
        </section>

        <section className="workspace-grid">
          <div className="control-card">
            <div className="card-heading"><div><span>01</span><h3>Загрузка и настройки</h3></div><Activity className="size-4 text-muted-foreground" /></div>
            <div
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => { e.preventDefault(); setDragging(false); addFiles(Array.from(e.dataTransfer.files ?? [])); }}
              onClick={() => !files.length && inputRef.current?.click()}
              className={`upload-zone ${dragging ? "upload-zone-active" : ""} ${files.length ? "upload-zone-filled" : ""}`}
            >
              {files.length ? <div className="upload-filled"><div className="thumb-grid">{files.map((f, i) => <div key={`${f.name}-${i}`} className="thumb"><img src={f.dataUrl} alt={f.name} /><button onClick={(e) => { e.stopPropagation(); setFiles((prev) => prev.filter((_, idx) => idx !== i)); }}><X className="size-3" /></button><span>{i + 1}</span></div>)}{files.length < 3 && <button className="add-thumb" onClick={(e) => { e.stopPropagation(); inputRef.current?.click(); }}><Plus className="size-4" /></button>}</div><p className="mt-3 text-xs text-muted-foreground">До 3 экранов · PNG, JPG, WEBP · 10 МБ</p></div> : <><div className="upload-icon"><Upload className="size-5" /></div><p className="mt-3 text-sm font-semibold">Перетащите файлы сюда</p><p className="mt-1 text-xs text-muted-foreground">или нажмите для выбора · до 3 изображений</p></>}
            </div>
            <input ref={inputRef} type="file" multiple accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => { addFiles(Array.from(e.target.files ?? [])); e.target.value = ""; }} />
            <div ref={optionsRef}><GenerationOptionsPanel value={options} onChange={setOptions} disabled={busy} /></div>
            <Button className="primary-action" disabled={busy || !deviceId || !files.length} onClick={() => generate.mutate()}>{busy ? <><Loader2 className="size-4 animate-spin" /> Генерирую…</> : <><Wand2 className="size-4" /> Создать прототип</>}</Button>
            {(busy || result) && <div className="progress-card"><div className="flex items-center justify-between text-xs"><span>{result ? "Прототип готов" : STEPS[step]}</span><span className="text-primary">{result ? "100%" : `${Math.round(((step + 1) / STEPS.length) * 100)}%`}</span></div><Progress value={((step + (result ? 1 : 0)) / STEPS.length) * 100} className="mt-2" /><div className="step-row">{STEPS.map((label, index) => <span key={label} className={result || index <= step ? "step-done" : ""}>{result || index < step ? <Check className="size-3" /> : index === step ? <Loader2 className="size-3 animate-spin" /> : <span className="step-dot" />} {label}</span>)}</div></div>}
            <Disclaimer />
          </div>

          <div className="result-card">
            <div className="result-toolbar">
              <div className="card-heading compact"><div><span>02</span><h3>Результат</h3></div>{result && <span className="ready-badge"><span /> Готов к просмотру</span>}</div>
              {result && <div className="result-actions"><div className="segmented">{([["result", "Превью"], ["split", "Рядом"], ["compare", "Сравнить"]] as [ViewMode, string][]).map(([mode, label]) => <button key={mode} onClick={() => setView(mode)} className={view === mode ? "active" : ""}>{mode === "compare" && <SplitSquareHorizontal className="size-3.5" />}{label}</button>)}</div><div className="segmented">{([["off", "Просмотр"], ["inspect", "Инспектор"], ["copy", "Копировать"]] as [PreviewMode, string][]).map(([mode, label]) => <button key={mode} onClick={() => { setPreviewMode(mode); if (mode !== "off") setView("result"); }} className={previewMode === mode ? "active" : ""}>{mode === "inspect" && <MousePointerClick className="size-3.5" />}{mode === "copy" && <Copy className="size-3.5" />}{label}</button>)}</div></div>}
            </div>

            {!result ? <div className="empty-preview"><div className="empty-orbit"><div className="empty-core"><Sparkles className="size-6" /></div></div><h4>{busy ? `${STEPS[step]}…` : "Ваш прототип появится здесь"}</h4><p>{busy ? "AI собирает структуру, компоненты и интерактив." : "Загрузите макет слева, чтобы начать генерацию."}</p><div className="empty-hints"><span><Check className="size-3" /> HTML / Tailwind</span><span><Check className="size-3" /> React / Lucide</span><span><Check className="size-3" /> Vue 3</span></div></div> : <>
              {view === "compare" && files[0] ? <div className="mt-4"><CompareSlider originalSrc={files[0].dataUrl} html={result.html} /></div> : <div className={`preview-area ${view === "split" ? "preview-split" : ""}`}>{view === "split" && files[0] ? <div className="original-stack">{files.map((f, index) => <img key={`${f.name}-${index}`} src={f.dataUrl} alt={`Оригинал ${index + 1}`} />)}</div> : null}<PreviewFrame html={result.html} mode={previewMode} auditRequest={auditRequest} onAuditReport={(report) => { setA11yReport(report); setAuditRunning(false); }} onHtmlChange={(html) => setResult((prev) => prev ? { ...prev, html } : prev)} /></div>}
              <div className="result-footer-actions"><button onClick={openInNewWindow}><ExternalLink className="size-4" /><span><strong>Открыть в новой вкладке</strong><small>Просмотр в браузере</small></span><ArrowUpRight className="ml-auto size-4" /></button><button onClick={copyAll}><Code2 className="size-4" /><span><strong>Скопировать код</strong><small>В буфер обмена</small></span></button><DropdownMenu><DropdownMenuTrigger asChild><button><Download className="size-4" /><span><strong>Скачать прототип</strong><small>HTML или ZIP</small></span></button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onClick={() => downloadZip(result.html, options.framework, title)}><FileArchive className="size-4" /> Скачать ZIP</DropdownMenuItem><DropdownMenuItem onClick={() => downloadHtml(result.html, title)}><Download className="size-4" /> Скачать HTML</DropdownMenuItem><DropdownMenuItem onClick={() => openInCodeSandbox(result.html)}><Code2 className="size-4" /> CodeSandbox</DropdownMenuItem></DropdownMenuContent></DropdownMenu></div>
              <A11yPanel report={a11yReport} running={auditRunning} onRun={() => { if (view === "compare") setView("result"); setAuditRunning(true); setAuditRequest((n) => n + 1); }} />
              {result.analysis ? <details className="analysis-box"><summary>Что распознано на макете</summary><pre>{result.analysis}</pre></details> : null}
              <div className="edit-box"><div><p className="text-sm font-semibold">Запросить правки к этой версии</p><p className="text-xs text-muted-foreground">Опишите, что нужно изменить — AI обновит текущий прототип.</p></div>{history.length ? <div className="history-line">{history.slice(-3).map((item, index) => <span key={`${item}-${index}`}>→ {item}</span>)}</div> : null}<form onSubmit={(e) => { e.preventDefault(); if (instruction.trim().length > 1) edit.mutate(instruction.trim()); }}><Input value={instruction} onChange={(e) => setInstruction(e.target.value)} placeholder="Например: сделай хедер sticky и добавь CTA" disabled={edit.isPending} /><Button type="submit" disabled={edit.isPending || instruction.trim().length < 2}>{edit.isPending ? <Loader2 className="size-4 animate-spin" /> : "Применить"}</Button></form></div>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground"><ProviderBadge used={result.provider} /><span>Проект сохранён.</span><Link to="/projects" className="text-primary hover:underline">Открыть мои проекты</Link><ShareDialog projectId={result.projectId} deviceId={deviceId} /></div>
            </>}
          </div>
        </section>
      </main>

      <Dialog open={templatesOpen} onOpenChange={setTemplatesOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Шаблоны дизайна</DialogTitle>
            <DialogDescription>Один клик — и цвета, шрифт, радиусы и тени применятся к следующей генерации.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            {DESIGN_TEMPLATES.map((template) => (
              <button key={template.id} type="button" onClick={() => applyTemplate(template.id)} className="rounded-xl border border-border p-3 text-left transition-colors hover:border-primary hover:bg-secondary/40">
                <div className="flex items-center gap-1.5">
                  {[template.options.primaryColor, template.options.secondaryColor, template.options.backgroundColor, template.options.surfaceColor, template.options.borderColor].map((color, i) => (
                    <span key={`${template.id}-${i}`} className="size-5 rounded-md border border-white/10" style={{ backgroundColor: color }} />
                  ))}
                </div>
                <p className="mt-2 text-sm font-semibold">{template.name}</p>
                <p className="text-xs text-muted-foreground">{template.description}</p>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Настройки генерации</DialogTitle>
            <DialogDescription>Применяются к следующей генерации прототипа.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Стек результата</p>
              <div className="mt-2 grid gap-1.5">
                {FRAMEWORKS.map((framework) => (
                  <button key={framework.id} type="button" onClick={() => setOptions((prev) => ({ ...prev, framework: framework.id }))} className={`rounded-lg border px-3 py-2.5 text-left transition-all ${options.framework === framework.id ? "border-primary bg-primary/10" : "border-border hover:border-primary/50"}`}>
                    <span className="block text-sm font-medium">{framework.label}</span>
                    <span className="block text-xs text-muted-foreground">{framework.hint}</span>
                  </button>
                ))}
              </div>
            </div>
            <label className="flex items-start justify-between gap-3 rounded-lg border border-border px-3 py-2.5">
              <span><span className="block text-sm font-medium">Улучшить и восстановить текст</span><span className="block text-xs text-muted-foreground">Заменяет размытый текст и Lorem Ipsum</span></span>
              <Switch checked={options.enhanceText} onCheckedChange={(v) => setOptions((prev) => ({ ...prev, enhanceText: v }))} />
            </label>
            <label className="flex items-start justify-between gap-3 rounded-lg border border-border px-3 py-2.5">
              <span><span className="block text-sm font-medium">Переключатель тем</span><span className="block text-xs text-muted-foreground">Светлая / тёмная тема в прототипе</span></span>
              <Switch checked={options.themeToggle} onCheckedChange={(v) => setOptions((prev) => ({ ...prev, themeToggle: v }))} />
            </label>
            <Button variant="secondary" className="w-full" onClick={() => { setOptions({ ...DEFAULT_OPTIONS, framework: options.framework }); toast.success("Настройки сброшены"); }}>Сбросить дизайн-токены</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Как это работает</DialogTitle>
            <DialogDescription>От скриншота до интерактивной страницы за четыре шага.</DialogDescription>
          </DialogHeader>
          <ol className="space-y-3 text-sm">
            <li><strong>1. Загрузите макет.</strong> До 3 экранов: PNG, JPG или WEBP, до 10 МБ каждый.</li>
            <li><strong>2. Настройте дизайн-систему.</strong> Стек (HTML, React, Vue), цвета, шрифт, радиусы, тени — или примените готовый шаблон.</li>
            <li><strong>3. Сгенерируйте прототип.</strong> AI распознаёт структуру и собирает рабочую страницу с интерактивом.</li>
            <li><strong>4. Доработайте и экспортируйте.</strong> Правки текстом, инспектор, проверка доступности, экспорт в HTML, ZIP или CodeSandbox, публичная ссылка.</li>
          </ol>
        </DialogContent>
      </Dialog>

    </div>
  );
}
