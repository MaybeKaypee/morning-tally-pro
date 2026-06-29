import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Trophy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Morning Attendance" },
      { name: "description", content: "Classroom on-time leaderboard and attendance statistics." },
    ],
  }),
  component: Dashboard,
});

type Classroom = { id: string; classroom_name: string; active: boolean };
type Attendance = { classroom_id: string; attendance_date: string; on_time_count: number; late_count: number };
type Range = "day" | "week" | "month" | "all";

function toISO(d: Date) {
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 10);
}
function todayISO() { return toISO(new Date()); }
function thisMonthISO() { return todayISO().slice(0, 7); }
// Monday of the week containing `date`
function weekStart(date: Date) {
  const d = new Date(date);
  const day = (d.getDay() + 6) % 7; // Mon=0..Sun=6
  d.setDate(d.getDate() - day);
  return d;
}
// HTML week input value like "2026-W26"
function isoWeekValue(date: Date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}
function weekValueToMonday(v: string) {
  const [y, w] = v.split("-W").map(Number);
  // ISO week 1 = week containing Jan 4
  const jan4 = new Date(Date.UTC(y, 0, 4));
  const jan4Day = jan4.getUTCDay() || 7;
  const week1Mon = new Date(jan4);
  week1Mon.setUTCDate(jan4.getUTCDate() - (jan4Day - 1));
  const mon = new Date(week1Mon);
  mon.setUTCDate(week1Mon.getUTCDate() + (w - 1) * 7);
  // Return as local-naive date matching that calendar day
  return new Date(mon.getUTCFullYear(), mon.getUTCMonth(), mon.getUTCDate());
}

function Dashboard() {
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [records, setRecords] = useState<Attendance[]>([]);
  const [range, setRange] = useState<Range>("day");
  const [day, setDay] = useState(todayISO());
  const [week, setWeek] = useState(isoWeekValue(new Date()));
  const [month, setMonth] = useState(thisMonthISO());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [cr, ar] = await Promise.all([
        supabase.from("classrooms").select("id, classroom_name, active"),
        supabase.from("attendance").select("classroom_id, attendance_date, on_time_count, late_count"),
      ]);
      setClassrooms(cr.data ?? []);
      setRecords(ar.data ?? []);
      setLoading(false);
    })();
  }, []);

  const { from, to, label } = useMemo(() => {
    if (range === "day") {
      return { from: day, to: day, label: new Date(day + "T00:00").toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" }) };
    }
    if (range === "week") {
      const mon = weekValueToMonday(week);
      const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
      return { from: toISO(mon), to: toISO(sun), label: `${toISO(mon)} → ${toISO(sun)}` };
    }
    if (range === "month") {
      const [y, m] = month.split("-").map(Number);
      const first = new Date(y, m - 1, 1);
      const last = new Date(y, m, 0);
      return { from: toISO(first), to: toISO(last), label: first.toLocaleDateString(undefined, { year: "numeric", month: "long" }) };
    }
    return { from: "0000-01-01", to: "9999-12-31", label: "All time" };
  }, [range, day, week, month]);

  const filtered = useMemo(
    () => records.filter((r) => r.attendance_date >= from && r.attendance_date <= to),
    [records, from, to],
  );

  const rows = useMemo(() => {
    const byClass: Record<string, { onTime: number; total: number; pctSum: number; n: number }> = {};
    for (const r of filtered) {
      const denom = r.on_time_count + r.late_count;
      if (denom === 0) continue;
      const entry = (byClass[r.classroom_id] ||= { onTime: 0, total: 0, pctSum: 0, n: 0 });
      entry.onTime += r.on_time_count;
      entry.total += denom;
      entry.pctSum += (r.on_time_count / denom) * 100;
      entry.n += 1;
    }
    return classrooms
      .filter((c) => c.active || byClass[c.id])
      .map((c) => {
        const b = byClass[c.id];
        const onTime = b?.onTime ?? 0;
        const total = b?.total ?? 0;
        const late = total - onTime;
        const pct = b ? (range === "day" ? (total > 0 ? (onTime / total) * 100 : 0) : b.pctSum / b.n) : 0;
        return { id: c.id, name: c.classroom_name, onTime, late, total, pct, submitted: !!b };
      })
      .sort((a, b) => {
        if (a.submitted !== b.submitted) return a.submitted ? -1 : 1;
        return b.pct - a.pct;
      });
  }, [filtered, classrooms, range]);

  const todays = useMemo(() => records.filter((r) => r.attendance_date === todayISO()), [records]);
  const summary = useMemo(() => {
    const onTime = todays.reduce((s, r) => s + r.on_time_count, 0);
    const late = todays.reduce((s, r) => s + r.late_count, 0);
    const total = onTime + late;
    const pct = total > 0 ? (onTime / total) * 100 : 0;
    return { submitted: new Set(todays.map((r) => r.classroom_id)).size, onTime, late, pct };
  }, [todays]);

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">On-time leaderboard for all classrooms.</p>
        </div>
      </header>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Classrooms submitted today" value={`${summary.submitted}/${classrooms.filter(c=>c.active).length}`} />
        <StatCard label="Before 07:20 (today)" value={summary.onTime} />
        <StatCard label="07:20 – 08:20 (today)" value={summary.late} />
        <StatCard label="On-time % (today)" value={`${summary.pct.toFixed(1)}%`} accent />
      </section>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-xl border bg-card p-1">
          {(["day","week","month","all"] as Range[]).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                range === r ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {r === "day" ? "Day" : r === "week" ? "Week" : r === "month" ? "Month" : "All Time"}
            </button>
          ))}
        </div>

        {range === "day" && (
          <input type="date" value={day} max={todayISO()} onChange={(e) => setDay(e.target.value)}
            className="h-9 rounded-xl border bg-card px-3 text-sm" />
        )}
        {range === "week" && (
          <input type="week" value={week} onChange={(e) => setWeek(e.target.value)}
            className="h-9 rounded-xl border bg-card px-3 text-sm" />
        )}
        {range === "month" && (
          <input type="month" value={month} onChange={(e) => setMonth(e.target.value)}
            className="h-9 rounded-xl border bg-card px-3 text-sm" />
        )}

        <span className="text-xs text-muted-foreground">{label}</span>
      </div>

      <section className="mt-4 rounded-2xl border bg-card p-4 shadow-sm sm:p-6">
        <h2 className="mb-3 text-base font-semibold">On-time % by classroom</h2>
        <div className="h-64 w-full">
          <ResponsiveContainer>
            <BarChart data={rows.map((r) => ({ name: r.name, pct: Number(r.pct.toFixed(1)) }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-20} textAnchor="end" height={60} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
              <Tooltip cursor={{ fill: "var(--accent)" }} formatter={(v: number) => `${v}%`} />
              <Bar dataKey="pct" fill="var(--primary)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="mt-4 overflow-hidden rounded-2xl border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Rank</th>
                <th className="px-4 py-3">Classroom</th>
                <th className="px-4 py-3 text-right">On-time %</th>
                <th className="px-4 py-3 text-right">Before 07:20</th>
                <th className="px-4 py-3 text-right">07:20–08:20</th>
                <th className="px-4 py-3 text-right">Total present</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Loading…</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No data yet.</td></tr>
              ) : rows.map((r, i) => (
                <tr key={r.id} className="border-t">
                  <td className="px-4 py-3">
                    <span className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${
                      r.submitted && i === 0 ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
                    }`}>
                      {r.submitted && i === 0 ? <Trophy className="h-3.5 w-3.5" /> : r.submitted ? i + 1 : "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-medium">{r.name}</td>
                  <td className="px-4 py-3 text-right font-semibold text-primary">
                    {r.submitted ? `${r.pct.toFixed(1)}%` : <span className="text-muted-foreground font-normal">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right">{r.submitted ? r.onTime : "—"}</td>
                  <td className="px-4 py-3 text-right">{r.submitted ? r.late : "—"}</td>
                  <td className="px-4 py-3 text-right">{r.submitted ? r.total : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

function StatCard({ label, value, accent }: { label: string; value: React.ReactNode; accent?: boolean }) {
  return (
    <div className={`rounded-2xl border p-4 shadow-sm ${accent ? "bg-primary text-primary-foreground" : "bg-card"}`}>
      <div className={`text-xs ${accent ? "text-primary-foreground/80" : "text-muted-foreground"}`}>{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
    </div>
  );
}
