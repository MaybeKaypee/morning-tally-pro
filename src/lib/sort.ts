// Natural sort for classroom names like "M5/1", "M5/2", "M5/10".
export function classroomCompare(a: string, b: string) {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}
