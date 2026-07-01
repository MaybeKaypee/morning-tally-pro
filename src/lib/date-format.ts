// Formats an ISO date (YYYY-MM-DD) as "Mon 23 Jul 2026".
export function formatShortDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso + "T00:00");
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
