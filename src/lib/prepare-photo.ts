// Decode orientation once and shrink large camera photos before model preprocessing.
// The preview uses these same pixels, so its boxes cannot disagree with EXIF rotation.
export const MAX_PHOTO_EDGE = 2048;

export function fittedPhotoSize(width: number, height: number) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new Error("The photo has invalid dimensions.");
  }
  const scale = Math.min(1, MAX_PHOTO_EDGE / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

function photoCanvas(width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Photo processing is unavailable on this browser.");
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  // Transparent uploads need the same white background as paper photos.
  context.fillStyle = "white";
  context.fillRect(0, 0, width, height);
  return { canvas, context };
}

export async function preparePhoto(file: File): Promise<{ canvas: HTMLCanvasElement; photo: Blob }> {
  let source: ImageBitmap | HTMLImageElement;
  let objectUrl: string | undefined;
  try {
    // Bitmap decoding handles camera EXIF orientation without relying on CSS image rendering.
    try {
      source = await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch {
      // Older browsers and formats supported only by the native image decoder.
      objectUrl = URL.createObjectURL(file);
      source = await new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error("Could not open this photo. Try a JPG or PNG."));
        image.src = objectUrl ?? "";
      });
    }
    try {
      const width = source instanceof HTMLImageElement ? source.naturalWidth : source.width;
      const height = source instanceof HTMLImageElement ? source.naturalHeight : source.height;
      const dimensions = fittedPhotoSize(width, height);
      const { canvas, context } = photoCanvas(dimensions.width, dimensions.height);
      context.drawImage(source, 0, 0, dimensions.width, dimensions.height);
      const photo = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Could not prepare this photo.")), "image/jpeg", 0.95);
      });
      return { canvas, photo };
    } finally {
      if (!(source instanceof HTMLImageElement)) source.close();
    }
  } finally {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  }
}

export function modelPhotoCanvas(image: HTMLCanvasElement, size: number) {
  const scale = Math.min(size / image.width, size / image.height);
  const width = Math.round(image.width * scale);
  const height = Math.round(image.height * scale);
  const padX = Math.round((size - width) / 2);
  const padY = Math.round((size - height) / 2);
  // Reduce in steps instead of a single giant camera-photo-to-640 draw.
  // This preserves thin pen strokes across browser resampling implementations.
  let current = image;
  while (current.width / 2 >= width && current.height / 2 >= height) {
    const next = photoCanvas(Math.max(width, Math.round(current.width / 2)), Math.max(height, Math.round(current.height / 2)));
    next.context.drawImage(current, 0, 0, next.canvas.width, next.canvas.height);
    current = next.canvas;
  }
  const { canvas, context } = photoCanvas(size, size);
  // Ultralytics letterbox padding is neutral 114, not the paper background.
  context.fillStyle = "rgb(114, 114, 114)";
  context.fillRect(0, 0, size, size);
  context.drawImage(current, padX, padY, width, height);
  return { canvas, context, scale, padX, padY };
}