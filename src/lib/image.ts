import type { Config } from "@imgly/background-removal";
import {
  convexHull,
  insetQuad,
  isConvex,
  minAreaRect,
  perspectiveMap,
  polygonArea,
  quadSize,
  snapCorners,
  type Point,
  type Quad,
} from "./geometry";

/** Tamaño final de la imagen de la figurita (proporción 3:4). */
export const STICKER_WIDTH = 600;
export const STICKER_HEIGHT = 800;

/** Lado máximo de la imagen que se le pasa al modelo: más grande no mejora la detección y es más lento. */
const MODEL_INPUT_MAX = 1024;
/** Lado máximo de la foto de la que se recorta el paquete, y del resultado enderezado. */
const SAMPLE_MAX = 2048;
const OUTPUT_MAX = 1000;
/** Si el paquete ocupa menos que esto de la foto, asumimos que el modelo no lo encontró. */
const MIN_SUBJECT_RATIO = 0.03;
/** Opacidad mínima para considerar un píxel parte del paquete. */
const SOLID_ALPHA = 128;
/** Se conservan las zonas de al menos este tamaño relativo a la más grande (ej: dos alfajores en la foto). */
const KEEP_COMPONENT_RATIO = 0.15;
/**
 * Qué tan parecida a un rectángulo tiene que ser la silueta para corregir la perspectiva usando sus esquinas.
 * Si es redondeada (un alfajor sin paquete), solo se endereza la rotación.
 */
const RECTANGULARITY_FOR_PERSPECTIVE = 0.85;
/** Las esquinas ajustadas tienen que cubrir al menos esto del rectángulo; si no, el modelo detectó algo raro. */
const MIN_SNAPPED_AREA = 0.85;
/** Cuánto se achica el recorte hacia adentro, para no dejar bordes del fondo. */
const INSET = 0.02;

export type ProcessStage = { kind: "preparing"; percent?: number } | { kind: "cutting" };

export type ProcessedPhoto = {
  /** Paquete recortado en rectángulo, enderezado y centrado. Null si no se pudo detectar. */
  scan: Blob | null;
  /** Esquinas usadas para el recorte (normalizadas 0–1), para poder ajustarlas a mano. */
  corners: Quad | null;
  /** Foto original recortada al centro, como alternativa. */
  photo: Blob;
};

const modelConfig: Config = {
  model: "isnet_quint8",
  output: { format: "image/png" },
};

let modelPromise: Promise<void> | null = null;
let progressListener: ((stage: ProcessStage) => void) | null = null;

/** Descarga el modelo (~40MB la primera vez, después queda en caché). Se puede llamar de antemano. */
export function preloadModel() {
  // El modelo y el runtime se descargan en varios archivos: sumamos el progreso de todos
  const files = new Map<string, { current: number; total: number }>();
  let shownPercent = 0;
  modelPromise ??= import("@imgly/background-removal")
    .then(({ preload }) =>
      preload({
        ...modelConfig,
        progress: (key, current, total) => {
          if (!key.startsWith("fetch:") || total <= 0) return;
          files.set(key, { current, total });
          let sum = 0;
          let sumTotal = 0;
          for (const f of files.values()) {
            sum += f.current;
            sumTotal += f.total;
          }
          // Pueden aparecer archivos nuevos a mitad de camino: el porcentaje mostrado nunca retrocede
          shownPercent = Math.max(shownPercent, Math.round((sum / sumTotal) * 100));
          progressListener?.({ kind: "preparing", percent: shownPercent });
        },
      }),
    )
    .catch((err) => {
      modelPromise = null;
      throw err;
    });
  return modelPromise;
}

export async function processPhoto(file: File, onStage?: (stage: ProcessStage) => void): Promise<ProcessedPhoto> {
  const photo = await toStickerPhoto(file);
  progressListener = onStage ?? null;
  try {
    await preloadModel();
    onStage?.({ kind: "cutting" });
    const corners = await detectCorners(file);
    return { photo, corners, scan: corners && (await scanWithCorners(file, corners)) };
  } catch (err) {
    console.error("No se pudo detectar el paquete", err);
    return { photo, scan: null, corners: null };
  } finally {
    progressListener = null;
  }
}

/**
 * Detecta el paquete con el modelo de quitar fondos y calcula sus 4 esquinas, normalizadas (0–1) respecto de la foto.
 * Null si no lo encuentra.
 */
export async function detectCorners(file: File): Promise<Quad | null> {
  const { removeBackground } = await import("@imgly/background-removal");
  const input = await downscale(file, MODEL_INPUT_MAX);
  const foreground = await createImageBitmap(await removeBackground(input, modelConfig));
  const subject = mainSubjectMask(foreground);
  foreground.close();
  if (!subject || subject.area / (subject.width * subject.height) < MIN_SUBJECT_RATIO) return null;

  const hull = convexHull(maskOutline(subject.mask, subject.width, subject.height));
  if (hull.length < 3) return null;
  const rect = minAreaRect(hull);
  let corners = rect;
  if (polygonArea(hull) / polygonArea(rect) >= RECTANGULARITY_FOR_PERSPECTIVE) {
    // Las esquinas reales corrigen la perspectiva, pero solo si forman un cuadrilátero razonable
    const snapped = snapCorners(rect, hull);
    if (isConvex(snapped) && polygonArea(snapped) / polygonArea(rect) >= MIN_SNAPPED_AREA) corners = snapped;
  }

  return insetQuad(corners, INSET).map((p) => ({ x: p.x / subject.width, y: p.y / subject.height })) as Quad;
}

/** Recorta el cuadrilátero (esquinas normalizadas 0–1) de la foto y lo endereza a un rectángulo. */
export async function scanWithCorners(file: File, corners: Quad): Promise<Blob> {
  const source = await loadScaled(file, SAMPLE_MAX);
  const quad = corners.map((p) => ({ x: p.x * source.width, y: p.y * source.height })) as Quad;

  const size = quadSize(quad);
  const fit = Math.min(1, OUTPUT_MAX / Math.max(size.width, size.height));
  const width = Math.max(1, Math.round(size.width * fit));
  const height = Math.max(1, Math.round(size.height * fit));

  const warped = warpPerspective(source, quad, width, height);
  const out = document.createElement("canvas");
  out.width = width;
  out.height = height;
  const ctx = out.getContext("2d")!;
  ctx.filter = "saturate(1.15) contrast(1.05)";
  ctx.drawImage(warped, 0, 0);
  return canvasToBlob(out, "image/jpeg", 0.88);
}

/** Endereza el cuadrilátero de la foto a un rectángulo de width × height (interpolación bilineal). */
function warpPerspective(source: ImageData, quad: Quad, width: number, height: number) {
  const map = perspectiveMap(width, height, quad);
  const { data: src, width: sw, height: sh } = source;
  const out = new ImageData(width, height);
  const dst = out.data;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const p = map(x + 0.5, y + 0.5);
      const fx = Math.min(Math.max(p.x - 0.5, 0), sw - 1);
      const fy = Math.min(Math.max(p.y - 0.5, 0), sh - 1);
      const x0 = Math.floor(fx);
      const y0 = Math.floor(fy);
      const x1 = Math.min(x0 + 1, sw - 1);
      const y1 = Math.min(y0 + 1, sh - 1);
      const tx = fx - x0;
      const ty = fy - y0;
      const i00 = (y0 * sw + x0) * 4;
      const i10 = (y0 * sw + x1) * 4;
      const i01 = (y1 * sw + x0) * 4;
      const i11 = (y1 * sw + x1) * 4;
      const o = (y * width + x) * 4;
      for (let c = 0; c < 3; c++) {
        const top = src[i00 + c] + (src[i10 + c] - src[i00 + c]) * tx;
        const bottom = src[i01 + c] + (src[i11 + c] - src[i01 + c]) * tx;
        dst[o + c] = top + (bottom - top) * ty;
      }
      dst[o + 3] = 255;
    }
  }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d")!.putImageData(out, 0, 0);
  return canvas;
}

/** Puntos del contorno de la máscara: el primer y último píxel de cada fila alcanzan para la envolvente convexa. */
function maskOutline(mask: Uint8Array, width: number, height: number): Point[] {
  const points: Point[] = [];
  for (let y = 0; y < height; y++) {
    const row = y * width;
    let left = -1;
    let right = -1;
    for (let x = 0; x < width; x++) {
      if (mask[row + x]) {
        if (left < 0) left = x;
        right = x;
      }
    }
    if (left >= 0) {
      points.push({ x: left, y }, { x: right + 1, y }, { x: left, y: y + 1 }, { x: right + 1, y: y + 1 });
    }
  }
  return points;
}

async function loadScaled(file: File, maxSide: number): Promise<ImageData> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

/** Recorta la foto al centro con proporción 3:4 y la reduce a un JPEG liviano. */
export async function toStickerPhoto(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });

  const targetRatio = STICKER_WIDTH / STICKER_HEIGHT;
  const sourceRatio = bitmap.width / bitmap.height;
  let sw = bitmap.width;
  let sh = bitmap.height;
  if (sourceRatio > targetRatio) {
    sw = bitmap.height * targetRatio;
  } else {
    sh = bitmap.width / targetRatio;
  }
  const sx = (bitmap.width - sw) / 2;
  const sy = (bitmap.height - sh) / 2;

  const canvas = createCanvas();
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, STICKER_WIDTH, STICKER_HEIGHT);
  bitmap.close();

  return canvasToBlob(canvas, "image/jpeg", 0.85);
}

/** Lado máximo de la miniatura que se usa en la grilla del álbum. */
const THUMB_MAX = 360;

/** Versión chica de la imagen de la figurita, para que el álbum cargue rápido. */
export async function toThumbnail(photo: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(photo);
  const scale = Math.min(1, THUMB_MAX / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvasToBlob(canvas, "image/jpeg", 0.8);
}

async function downscale(file: File, maxSide: number): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvasToBlob(canvas, "image/jpeg", 0.92);
}

/**
 * El modelo a veces marca manchitas sueltas (reflejos, objetos del fondo).
 * Devuelve una máscara solo con las zonas conectadas grandes.
 */
function mainSubjectMask(bitmap: ImageBitmap) {
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(bitmap, 0, 0);
  const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const size = width * height;

  // Etiquetar zonas conectadas de píxeles bien opacos
  const labels = new Int32Array(size);
  const areas = [0];
  const stack: number[] = [];
  for (let start = 0; start < size; start++) {
    if (labels[start] || data[start * 4 + 3] <= SOLID_ALPHA) continue;
    const label = areas.length;
    let area = 0;
    labels[start] = label;
    stack.push(start);
    while (stack.length) {
      const i = stack.pop()!;
      area++;
      const x = i % width;
      const visit = (n: number) => {
        if (!labels[n] && data[n * 4 + 3] > SOLID_ALPHA) {
          labels[n] = label;
          stack.push(n);
        }
      };
      if (x > 0) visit(i - 1);
      if (x < width - 1) visit(i + 1);
      if (i >= width) visit(i - width);
      if (i + width < size) visit(i + width);
    }
    areas.push(area);
  }

  const largest = Math.max(0, ...areas);
  if (largest === 0) return null;
  const keep = areas.map((a) => a >= largest * KEEP_COMPONENT_RATIO);

  const mask = new Uint8Array(size);
  let area = 0;
  for (let i = 0; i < size; i++) {
    if (labels[i] && keep[labels[i]]) {
      mask[i] = 1;
      area++;
    }
  }
  return { mask, width, height, area };
}

function createCanvas() {
  const canvas = document.createElement("canvas");
  canvas.width = STICKER_WIDTH;
  canvas.height = STICKER_HEIGHT;
  return canvas;
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("No se pudo procesar la imagen"))),
      type,
      quality,
    );
  });
}
