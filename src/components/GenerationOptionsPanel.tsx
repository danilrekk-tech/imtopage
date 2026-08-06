import { ChevronDown, Palette } from "lucide-react";
import { useState } from "react";

import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  FONTS,
  FRAMEWORKS,
  PRESET_COLORS,
  RADII,
  type GenerationOptions,
} from "@/lib/generation-options";

type Props = {
  value: GenerationOptions;
  onChange: (next: GenerationOptions) => void;
  disabled?: boolean;
};

export function GenerationOptionsPanel({ value, onChange, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const set = <K extends keyof GenerationOptions>(key: K, next: GenerationOptions[K]) =>
    onChange({ ...value, [key]: next });

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Стек результата
        </p>
        <div className="mt-2 grid gap-1.5">
          {FRAMEWORKS.map((framework) => {
            const active = value.framework === framework.id;
            return (
              <button
                key={framework.id}
                type="button"
                disabled={disabled}
                onClick={() => set("framework", framework.id)}
                className={`rounded-lg border px-3 py-2.5 text-left transition-all active:scale-[0.99] ${
                  active
                    ? "border-primary bg-primary/10"
                    : "border-border hover:border-primary/50 hover:bg-secondary/50"
                }`}
              >
                <span className="block text-sm font-medium">{framework.label}</span>
                <span className="block text-xs text-muted-foreground">{framework.hint}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="rounded-lg border border-border">
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          className="flex w-full items-center justify-between px-3 py-2.5 text-sm"
        >
          <span className="flex items-center gap-2">
            <Palette className="size-4 text-primary" /> Дизайн-токены
          </span>
          <ChevronDown
            className={`size-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
          />
        </button>

        {open ? (
          <div className="space-y-4 border-t border-border px-3 py-4">
            <div>
              <p className="text-xs text-muted-foreground">Основной цвет</p>
              <div className="mt-2 flex items-center gap-2">
                <input
                  type="color"
                  aria-label="Основной цвет"
                  value={value.primaryColor}
                  disabled={disabled}
                  onChange={(e) => set("primaryColor", e.target.value)}
                  className="size-9 cursor-pointer rounded-md border border-border bg-transparent"
                />
                <Input
                  value={value.primaryColor}
                  disabled={disabled}
                  onChange={(e) => set("primaryColor", e.target.value)}
                  className="h-9 font-mono text-xs uppercase"
                />
              </div>
              <div className="mt-2 flex gap-1.5">
                {PRESET_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    aria-label={color}
                    disabled={disabled}
                    onClick={() => set("primaryColor", color)}
                    style={{ backgroundColor: color }}
                    className={`size-6 rounded-md border transition-transform hover:scale-110 ${
                      value.primaryColor.toLowerCase() === color.toLowerCase()
                        ? "border-foreground"
                        : "border-transparent"
                    }`}
                  />
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs text-muted-foreground">Шрифт</p>
              <div className="mt-2 grid grid-cols-2 gap-1.5">
                {FONTS.map((font) => (
                  <button
                    key={font}
                    type="button"
                    disabled={disabled}
                    onClick={() => set("fontFamily", font)}
                    className={`rounded-md border px-2 py-1.5 text-xs transition-colors ${
                      value.fontFamily === font
                        ? "border-primary bg-primary/10"
                        : "border-border hover:bg-secondary/50"
                    }`}
                  >
                    {font}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs text-muted-foreground">Скругление углов</p>
              <div className="mt-2 grid grid-cols-4 gap-1.5">
                {RADII.map((radius) => (
                  <button
                    key={radius.id}
                    type="button"
                    disabled={disabled}
                    onClick={() => set("radius", radius.id)}
                    className={`border px-2 py-1.5 text-xs transition-colors ${
                      value.radius === radius.id
                        ? "border-primary bg-primary/10"
                        : "border-border hover:bg-secondary/50"
                    }`}
                    style={{ borderRadius: radius.value === "9999px" ? "9999px" : radius.value }}
                  >
                    {radius.id}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <label className="flex items-start justify-between gap-3 rounded-lg border border-border px-3 py-2.5">
        <span>
          <span className="block text-sm font-medium">Улучшить и восстановить текст</span>
          <span className="block text-xs text-muted-foreground">
            Заменяет размытый текст и Lorem Ipsum на продающий копирайт
          </span>
        </span>
        <Switch
          checked={value.enhanceText}
          disabled={disabled}
          onCheckedChange={(checked) => set("enhanceText", checked)}
        />
      </label>

      <label className="flex items-start justify-between gap-3 rounded-lg border border-border px-3 py-2.5">
        <span>
          <span className="block text-sm font-medium">Переключатель тем в результате</span>
          <span className="block text-xs text-muted-foreground">
            Светлая / тёмная тема в шапке готовой страницы
          </span>
        </span>
        <Switch
          checked={value.themeToggle}
          disabled={disabled}
          onCheckedChange={(checked) => set("themeToggle", checked)}
        />
      </label>
    </div>
  );
}
