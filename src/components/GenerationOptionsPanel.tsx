import { ChevronDown, Copy, Palette, RotateCcw, Save, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  FONTS, FRAMEWORKS, PRESET_COLORS, RADII, SHADOWS, SPACING,
  DEFAULT_OPTIONS, type GenerationOptions, type TokenPreset,
} from "@/lib/generation-options";

type Props = { value: GenerationOptions; onChange: (next: GenerationOptions) => void; disabled?: boolean };
const STORAGE_KEY = "imtopage-token-presets-v2";
const TOKEN_FIELDS: Array<[keyof GenerationOptions, string]> = [
  ["primaryColor", "Акцент"], ["secondaryColor", "Вторичный"], ["backgroundColor", "Фон"],
  ["surfaceColor", "Поверхность"], ["textColor", "Текст"], ["mutedColor", "Вторичный текст"], ["borderColor", "Границы"],
];

function readPresets(): TokenPreset[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]") as TokenPreset[]; } catch { return []; }
}

export function GenerationOptionsPanel({ value, onChange, disabled }: Props) {
  const [open, setOpen] = useState(true);
  const [presets, setPresets] = useState<TokenPreset[]>([]);
  const [presetName, setPresetName] = useState("");
  useEffect(() => setPresets(readPresets()), []);
  const set = <K extends keyof GenerationOptions>(key: K, next: GenerationOptions[K]) => onChange({ ...value, [key]: next });
  const tokenPreview = useMemo(() => [value.primaryColor, value.secondaryColor, value.backgroundColor, value.surfaceColor, value.textColor, value.mutedColor, value.borderColor], [value]);

  const savePreset = () => {
    const name = presetName.trim() || `Моя система ${presets.length + 1}`;
    const preset: TokenPreset = {
      id: crypto.randomUUID(), name,
      options: {
        primaryColor: value.primaryColor, secondaryColor: value.secondaryColor,
        backgroundColor: value.backgroundColor, surfaceColor: value.surfaceColor,
        textColor: value.textColor, mutedColor: value.mutedColor, borderColor: value.borderColor,
        fontFamily: value.fontFamily, radius: value.radius, spacing: value.spacing, shadow: value.shadow,
      },
    };
    const next = [preset, ...presets].slice(0, 12); setPresets(next); localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); setPresetName(""); toast.success("Дизайн-система сохранена");
  };
  const deletePreset = (id: string) => { const next = presets.filter((p) => p.id !== id); setPresets(next); localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); };
  const copyTokens = async () => { await navigator.clipboard.writeText(JSON.stringify(value, null, 2)); toast.success("Токены скопированы"); };

  return <div className="space-y-4">
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Стек результата</p>
      <div className="mt-2 grid gap-1.5">{FRAMEWORKS.map((framework) => <button key={framework.id} type="button" disabled={disabled} onClick={() => set("framework", framework.id)} className={`rounded-lg border px-3 py-2.5 text-left transition-all ${value.framework === framework.id ? "border-primary bg-primary/10" : "border-border hover:border-primary/50 hover:bg-secondary/50"}`}><span className="block text-sm font-medium">{framework.label}</span><span className="block text-xs text-muted-foreground">{framework.hint}</span></button>)}</div>
    </div>

    <div className="rounded-xl border border-border overflow-hidden">
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between px-3 py-3 text-sm"><span className="flex items-center gap-2"><Palette className="size-4 text-primary" /> Дизайн-токены <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] text-primary">{tokenPreview.length} токенов</span></span><ChevronDown className={`size-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} /></button>
      {open && <div className="space-y-5 border-t border-border px-3 py-4">
        <div className="flex items-center gap-2">{tokenPreview.map((color, i) => <span key={`${color}-${i}`} title={color} className="size-7 rounded-lg border border-white/10 shadow-inner" style={{ backgroundColor: color }} />)}</div>
        <div className="grid grid-cols-2 gap-3">{TOKEN_FIELDS.map(([key, label]) => <label key={String(key)} className="block"><span className="text-[11px] text-muted-foreground">{label}</span><div className="mt-1 flex gap-1.5"><input type="color" value={String(value[key])} disabled={disabled} onChange={(e) => set(key, e.target.value as never)} className="size-9 shrink-0 cursor-pointer rounded-md border border-border bg-transparent" /><Input value={String(value[key])} disabled={disabled} onChange={(e) => set(key, e.target.value as never)} className="h-9 font-mono text-[11px] uppercase" /></div></label>)}</div>
        <div><span className="text-[11px] text-muted-foreground">Быстрый выбор акцента</span><div className="mt-2 flex flex-wrap gap-2">{PRESET_COLORS.map((color) => <button key={color} type="button" aria-label={color} disabled={disabled} onClick={() => set("primaryColor", color)} style={{ backgroundColor: color }} className={`size-7 rounded-lg border ${value.primaryColor.toLowerCase() === color.toLowerCase() ? "border-foreground ring-2 ring-primary/30" : "border-transparent"}`} />)}</div></div>
        <div><span className="text-[11px] text-muted-foreground">Шрифт</span><div className="mt-2 grid grid-cols-2 gap-1.5">{FONTS.map((font) => <button key={font} type="button" disabled={disabled} onClick={() => set("fontFamily", font)} className={`rounded-md border px-2 py-2 text-xs ${value.fontFamily === font ? "border-primary bg-primary/10" : "border-border hover:bg-secondary/50"}`}>{font}</button>)}</div></div>
        <div><span className="text-[11px] text-muted-foreground">Скругление</span><div className="mt-2 grid grid-cols-4 gap-1.5">{RADII.map((r) => <button key={r.id} type="button" disabled={disabled} onClick={() => set("radius", r.id)} className={`border px-2 py-1.5 text-xs ${value.radius === r.id ? "border-primary bg-primary/10" : "border-border"}`} style={{ borderRadius: r.value === "9999px" ? "9999px" : r.value }}>{r.label}</button>)}</div></div>
        <div><span className="text-[11px] text-muted-foreground">Плотность</span><div className="mt-2 grid grid-cols-3 gap-1.5">{SPACING.map((r) => <button key={r.id} type="button" disabled={disabled} onClick={() => set("spacing", r.id)} className={`border rounded-md px-2 py-2 text-xs ${value.spacing === r.id ? "border-primary bg-primary/10" : "border-border"}`}>{r.label}</button>)}</div></div>
        <div><span className="text-[11px] text-muted-foreground">Тени</span><div className="mt-2 grid grid-cols-3 gap-1.5">{SHADOWS.map((r) => <button key={r.id} type="button" disabled={disabled} onClick={() => set("shadow", r.id)} className={`border rounded-md px-2 py-2 text-xs ${value.shadow === r.id ? "border-primary bg-primary/10" : "border-border"}`}>{r.label}</button>)}</div></div>
        <div className="flex gap-2"><Input value={presetName} onChange={(e) => setPresetName(e.target.value)} placeholder="Название дизайн-системы" disabled={disabled} /><Button type="button" variant="secondary" size="sm" onClick={savePreset} disabled={disabled}><Save className="size-4" /> Сохранить</Button><Button type="button" variant="ghost" size="icon" onClick={copyTokens} title="Скопировать JSON"><Copy className="size-4" /></Button><Button type="button" variant="ghost" size="icon" onClick={() => onChange({ ...DEFAULT_OPTIONS, framework: value.framework })} title="Сбросить"><RotateCcw className="size-4" /></Button></div>
        {presets.length > 0 && <div><div className="mb-2 flex items-center justify-between"><span className="text-[11px] text-muted-foreground">Сохранённые системы</span><span className="text-[10px] text-muted-foreground">локально</span></div><div className="space-y-1.5">{presets.map((preset) => <div key={preset.id} className="flex items-center gap-2 rounded-lg border border-border px-2 py-2"><button type="button" disabled={disabled} onClick={() => onChange({ ...value, ...preset.options })} className="min-w-0 flex-1 truncate text-left text-xs hover:text-primary">{preset.name}</button><button type="button" className="text-muted-foreground hover:text-destructive" onClick={() => deletePreset(preset.id)} title="Удалить"><Trash2 className="size-3.5" /></button></div>)}</div></div>}
      </div>}
    </div>

    <label className="flex items-start justify-between gap-3 rounded-lg border border-border px-3 py-2.5"><span><span className="block text-sm font-medium">Улучшить и восстановить текст</span><span className="block text-xs text-muted-foreground">Заменяет размытый текст и Lorem Ipsum</span></span><Switch checked={value.enhanceText} disabled={disabled} onCheckedChange={(v) => set("enhanceText", v)} /></label>
    <label className="flex items-start justify-between gap-3 rounded-lg border border-border px-3 py-2.5"><span><span className="block text-sm font-medium">Переключатель тем</span><span className="block text-xs text-muted-foreground">Светлая / тёмная тема в готовом прототипе</span></span><Switch checked={value.themeToggle} disabled={disabled} onCheckedChange={(v) => set("themeToggle", v)} /></label>
  </div>;
}
