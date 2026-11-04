export type Mark = { x: number; y: number; w: number; h: number };
export type MarkState = { count: number; marks: Mark[] };

export function removeMark(state: MarkState, index: number): MarkState {
  if (index < 0 || index >= state.marks.length) return state;
  return { count: Math.max(0, state.count - 1), marks: state.marks.filter((_, i) => i !== index) };
}

export function addMark(state: MarkState, x: number, y: number, w: number, h: number): MarkState {
  if (x < 0 || x > 1 || y < 0 || y > 1) return state;
  return { count: state.count + 1, marks: [...state.marks, { x: x - w / 2, y: y - h / 2, w, h }] };
}

export function markDiameter(marks: Mark[], width: number, height: number): number {
  if (!marks.length) return Math.min(width, height) * 0.04;
  const diameters = marks.map((mark) => Math.max(mark.w * width, mark.h * height)).sort((a, b) => a - b);
  return diameters[Math.floor(diameters.length / 2)];
}