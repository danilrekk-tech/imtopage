/** Извлечение дизайн-токенов из загруженного скриншота (клиент, canvas). */

import type { GenerationOptions } from "@/lib/generation-options";

export type ExtractedTokens = Pick<
  GenerationOptions,
  "primaryColor" | "secondaryColor" | "backgroundColor" | "surfaceColor" | "textColor" | "mutedColor" | "borderColor"
>;

type RGB = { r: number; g: number; b: number };

const toHex = ({ r, g, b }: RGB) => `#${[r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("").toUpperCase()}`;
const luminance = ({ r, g, b }: RGB) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
const contrast = (a: RGB, b: RGB) => {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (l1 + 0.05) / (l2 + 0.05);
};
const saturation = ({ r, g, b }: RGB) => {
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  return max === 0 ? 0 : (max - min) / max;
};
const mix = (a: RGB, b: RGB, t: number): RGB => ({ r: a.r + (b.r - a.r) * t, g: a.g + (b.g - a.g) * t, b: a.b + (b.b - a.b) * t });
const distance = (a: RGB, b: RGB) => Math.abs(a.r - b.r) + Math.abs(a.g - b.g) + Math.abs(a.b - b.b);

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Не удалось прочитать изображение"));
    img.src = dataUrl;
  });
}

/** Считывает палитру со скриншота и превращает её в набор дизайн-токенов. */
export async function extractTokensFromImage(dataUrl: string): Promise<ExtractedTokens> {
  const img = await loadImage(dataUrl);
  const width = 180;
  const height = Math.max(1, Math.round((img.height / img.width) * width)) || 1;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas недоступен");
  ctx.drawImage(img, 0, 0, width, height);
  const { data } = ctx.getImageData(0, 0, width, height);

  const buckets = new Map<string, { color: RGB; count: number }>();
  for (let i = 0; i < data.length; i += 4) {
    if ((data[i + 3] ?? 255) < 128) continue;
    const r = data[i] ?? 0, g = data[i + 1] ?? 0, b = data[i + 2] ?? 0;
    const key = `${r >> 4}-${g >> 4}-${b >> 4}`;
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.count += 1;
      bucket.color = mix(bucket.color, { r, g, b }, 1 / bucket.count);
    } else {
      buckets.set(key, { color: { r, g, b }, count: 1 });
    }
  }
  const sorted = [...buckets.values()].sort((a, b) => b.count - a.count);
  if (!sorted.length) throw new Error("Не удалось распознать цвета");

  const background = sorted[0]!.color;
  const dark = luminance(background) < 0.5;

  const surface =
    sorted.slice(1).find((c) => distance(c.color, background) > 25 && distance(c.color, background) < 190 && contrast(c.color, background) < 2)?.color ??
    mix(background, dark ? { r: 255, g: 255, b: 255 } : { r: 0, g: 0, b: 0 }, 0.06);

  const text =
    sorted.find((c) => contrast(c.color, background) > 6.5)?.color ??
    (dark ? { r: 246, g: 248, b: 255 } : { r: 15, g: 23, b: 42 });

  const accentCandidates = sorted
    .filter((c) => saturation(c.color) > 0.28 && contrast(c.color, background) > 1.6)
    .sort((a, b) => saturation(b.color) * Math.log(b.count + 1) - saturation(a.color) * Math.log(a.count + 1));
  const primary = accentCandidates[0]?.color ?? mix(background, text, 0.7);
  const secondary =
    accentCandidates.find((c) => distance(c.color, primary) > 90)?.color ?? mix(primary, dark ? { r: 255, g: 255, b: 255 } : { r: 0, g: 0, b: 0 }, 0.25);

  return {
    backgroundColor: toHex(background),
    surfaceColor: toHex(surface),
    textColor: toHex(text),
    mutedColor: toHex(mix(text, background, 0.45)),
    borderColor: toHex(mix(background, text, 0.16)),
    primaryColor: toHex(primary),
    secondaryColor: toHex(secondary),
  };
}
