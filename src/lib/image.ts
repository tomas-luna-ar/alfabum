/** Tamaño final de la foto de la figurita (proporción 3:4). */
export const STICKER_WIDTH = 600;
export const STICKER_HEIGHT = 800;

/**
 * Recorta la imagen al centro con proporción 3:4 y la reduce a un JPEG liviano,
 * para que el álbum no ocupe cientos de MB en el navegador.
 */
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

  const canvas = document.createElement("canvas");
  canvas.width = STICKER_WIDTH;
  canvas.height = STICKER_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No se pudo procesar la imagen");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, STICKER_WIDTH, STICKER_HEIGHT);
  bitmap.close();

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("No se pudo procesar la imagen"))),
      "image/jpeg",
      0.85,
    );
  });
}
