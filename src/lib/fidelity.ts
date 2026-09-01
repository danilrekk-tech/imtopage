export type FidelityReport = {
  score: number;
  level: "Отличное" | "Хорошее" | "Среднее" | "Низкое";
  pixelSimilarity: number | null;
  aspectSimilarity: number;
  note: string;
};

function level(score: number): FidelityReport["level"] {
  if (score >= 90) return "Отличное";
  if (score >= 75) return "Хорошее";
  if (score >= 55) return "Среднее";
  return "Низкое";
}

async function loadImage(src: string): Promise<HTMLImageElement> {
  return await new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Не удалось загрузить исходное изображение."));
    image.src = src;
  });
}

async function captureFrame(frame: HTMLIFrameElement): Promise<HTMLCanvasElement> {
  const doc = frame.contentDocument;
  if (!doc?.documentElement) throw new Error("Не удалось получить содержимое превью.");

  const width = Math.max(doc.documentElement.scrollWidth, frame.clientWidth, 320);
  const height = Math.max(doc.documentElement.scrollHeight, frame.clientHeight, 240);
  const clone = doc.documentElement.cloneNode(true) as HTMLElement;
  clone.querySelectorAll("script").forEach((node) => node.remove());

  const serialized = new XMLSerializer().serializeToString(clone);
  const svg = `\n<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">\n  <foreignObject width="100%" height="100%">\n    <div xmlns="http://www.w3.org/1999/xhtml" style="width:${width}px;min-height:${height}px;overflow:hidden">${serialized}</div>\n  </foreignObject>\n</svg>`;

  const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  try {
    const image = await loadImage(url);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas недоступен.");
    ctx.drawImage(image, 0, 0);
    return canvas;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function aspectScore(a: number, b: number) {
  const delta = Math.abs(Math.log(Math.max(a, 0.01) / Math.max(b, 0.01)));
  return Math.max(0, Math.min(100, 100 - delta * 55));
}

function pixelScore(a: HTMLCanvasElement, b: HTMLCanvasElement) {
  const size = 72;
  const ca = document.createElement("canvas");
  const cb = document.createElement("canvas");
  ca.width = cb.width = size;
  ca.height = cb.height = size;
  const ax = ca.getContext("2d", { willReadFrequently: true });
  const bx = cb.getContext("2d", { willReadFrequently: true });
  if (!ax || !bx) return null;
  ax.drawImage(a, 0, 0, size, size);
  bx.drawImage(b, 0, 0, size, size);
  const aa = ax.getImageData(0, 0, size, size).data;
  const bb = bx.getImageData(0, 0, size, size).data;
  let diff = 0;
  for (let i = 0; i < aa.length; i += 4) {
    diff +=
      Math.abs((aa[i] ?? 0) - (bb[i] ?? 0)) +
      Math.abs((aa[i + 1] ?? 0) - (bb[i + 1] ?? 0)) +
      Math.abs((aa[i + 2] ?? 0) - (bb[i + 2] ?? 0));
  }
  const maxDiff = size * size * 3 * 255;
  return Math.max(0, Math.min(100, 100 - (diff / maxDiff) * 100));
}

export async function evaluateFidelity(sourceUrl: string, frame: HTMLIFrameElement): Promise<FidelityReport> {
  const source = await loadImage(sourceUrl);
  const sourceCanvas = document.createElement("canvas");
  sourceCanvas.width = source.naturalWidth;
  sourceCanvas.height = source.naturalHeight;
  const sourceCtx = sourceCanvas.getContext("2d");
  if (!sourceCtx) throw new Error("Не удалось подготовить исходное изображение.");
  try {
    sourceCtx.drawImage(source, 0, 0);
  } catch {
    return {
      score: 50,
      level: level(50),
      pixelSimilarity: null,
      aspectSimilarity: 50,
      note: "Браузер запретил чтение пикселей исходного изображения. Оценка будет доступна после настройки CORS для хранилища изображений.",
    };
  }

  let resultCanvas: HTMLCanvasElement;
  try {
    resultCanvas = await captureFrame(frame);
  } catch {
    const frameRatio = frame.clientWidth / Math.max(frame.clientHeight, 1);
    const aspectSimilarity = aspectScore(sourceCanvas.width / sourceCanvas.height, frameRatio);
    return {
      score: Math.round(aspectSimilarity),
      level: level(aspectSimilarity),
      pixelSimilarity: null,
      aspectSimilarity: Math.round(aspectSimilarity),
      note: "Не удалось безопасно снять кадр превью. Показана ориентировочная оценка по геометрии рабочей области.",
    };
  }

  const aspectSimilarity = aspectScore(
    sourceCanvas.width / sourceCanvas.height,
    resultCanvas.width / resultCanvas.height,
  );
  let pixelSimilarity: number | null = null;
  try {
    pixelSimilarity = pixelScore(sourceCanvas, resultCanvas);
  } catch {
    pixelSimilarity = null;
  }

  const score = Math.round(
    pixelSimilarity == null ? aspectSimilarity : pixelSimilarity * 0.82 + aspectSimilarity * 0.18,
  );
  return {
    score,
    level: level(score),
    pixelSimilarity: pixelSimilarity == null ? null : Math.round(pixelSimilarity),
    aspectSimilarity: Math.round(aspectSimilarity),
    note:
      pixelSimilarity == null
        ? "Оценка рассчитана по геометрии страницы: браузер не разрешил безопасно снять изображение превью."
        : "Автоматическая оценка по визуальному сходству снимка результата и исходного изображения. Это ориентир, а не экспертная оценка дизайнера.",
  };
}
