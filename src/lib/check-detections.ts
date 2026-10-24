// Uploaded Ultralytics model: class 0 = leave, class 1 = present.
export const PRESENT_CLASS = 1;
export const CONFIDENCE_THRESHOLD = 0.25;
const IOU_THRESHOLD = 0.45;

type Box = { x: number; y: number; w: number; h: number; score: number; classId: number };

// A present-class box as a normalized top-left rectangle in the model input image.
export type Detection = { x: number; y: number; w: number; h: number; score: number };

function overlap(a: Box, b: Box) {
  const width = Math.max(0, Math.min(a.x + a.w / 2, b.x + b.w / 2) - Math.max(a.x - a.w / 2, b.x - b.w / 2));
  const height = Math.max(0, Math.min(a.y + a.h / 2, b.y + b.h / 2) - Math.max(a.y - a.h / 2, b.y - b.h / 2));
  const intersection = width * height;
  return intersection / (a.w * a.h + b.w * b.h - intersection || 1);
}

function parseDetections(data: Float32Array, columns: number): Box[] {
  if (!Number.isInteger(columns) || columns <= 0 || data.length !== columns * 6) {
    throw new Error("Unexpected model output.");
  }
  const boxes: Box[] = [];
  for (let i = 0; i < columns; i++) {
    const leave = data[4 * columns + i];
    const present = data[5 * columns + i];
    const score = Math.max(leave, present);
    if (!Number.isFinite(score) || score < CONFIDENCE_THRESHOLD) continue;
    const w = data[2 * columns + i];
    const h = data[3 * columns + i];
    if (w <= 0 || h <= 0) continue;
    boxes.push({ x: data[i], y: data[columns + i], w, h, score, classId: present > leave ? 1 : 0 });
  }
  return boxes;
}

function nonMaxSuppress(boxes: Box[]): Box[] {
  boxes.sort((a, b) => b.score - a.score);
  const kept: Box[] = [];
  for (const box of boxes) {
    if (!kept.some((other) => other.classId === box.classId && overlap(box, other) > IOU_THRESHOLD)) kept.push(box);
  }
  return kept;
}

export function countPresentDetections(data: Float32Array, columns: number): number {
  return nonMaxSuppress(parseDetections(data, columns)).filter((box) => box.classId === PRESENT_CLASS).length;
}

export function detectPresentBoxes(data: Float32Array, columns: number): Detection[] {
  return nonMaxSuppress(parseDetections(data, columns))
    .filter((box) => box.classId === PRESENT_CLASS)
    .map(({ x, y, w, h, score }) => ({ x: x - w / 2, y: y - h / 2, w, h, score }));
}
