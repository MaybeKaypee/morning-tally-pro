import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { classroomCompare } from "@/lib/sort";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Submit Attendance — Morning Attendance" },
      { name: "description", content: "Submit today's morning attendance for your classroom." },
    ],
  }),
  component: AttendanceForm,
});

type Classroom = { id: string; classroom_name: string; code: string | null };

function todayISO() {
  const d = new Date();
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 10);
}

function AttendanceForm() {
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [code, setCode] = useState("");
  const [onTime, setOnTime] = useState("");
  const [total, setTotal] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    supabase
      .from("classrooms")
      .select("id, classroom_name, code")
      .eq("active", true)
      .then(({ data, error }) => {
        if (error) toast.error(error.message);
        else setClassrooms((data ?? []).sort((a, b) => classroomCompare(a.classroom_name, b.classroom_name)));
        setLoading(false);
      });
  }, []);

  const matched = useMemo<Classroom | null>(() => {
    const c = code.trim();
    if (!c) return null;
    return classrooms.find((x) => (x.code ?? "").toLowerCase() === c.toLowerCase()) ?? null;
  }, [code, classrooms]);

  const classroomId = matched?.id ?? "";

  // Load existing today's record when classroom changes, so partial edits merge.
  useEffect(() => {
    if (!classroomId) { setOnTime(""); setTotal(""); return; }
    supabase
      .from("attendance")
      .select("on_time_count, late_count")
      .eq("classroom_id", classroomId)
      .eq("attendance_date", todayISO())
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setOnTime(data.on_time_count > 0 ? String(data.on_time_count) : "");
          const t = data.on_time_count + data.late_count;
          setTotal(t > 0 ? String(t) : "");
        } else {
          setOnTime(""); setTotal("");
        }
      });
  }, [classroomId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSuccess(false);
    if (!classroomId) return toast.error("Enter a valid classroom code.");

    const onTimeProvided = onTime.trim() !== "";
    const totalProvided = total.trim() !== "";
    if (!onTimeProvided && !totalProvided) {
      return toast.error("Enter at least one number to save.");
    }

    const o = onTimeProvided ? Number(onTime) : NaN;
    const t = totalProvided ? Number(total) : NaN;
    if (onTimeProvided && (!Number.isInteger(o) || o < 0)) {
      return toast.error("Before 07:20 must be a non-negative whole number.");
    }
    if (totalProvided && (!Number.isInteger(t) || t < 0)) {
      return toast.error("Total present must be a non-negative whole number.");
    }

    setSubmitting(true);

    const { data: existing } = await supabase
      .from("attendance")
      .select("on_time_count, late_count")
      .eq("classroom_id", classroomId)
      .eq("attendance_date", todayISO())
      .maybeSingle();

    const prevOn = existing?.on_time_count ?? 0;
    const prevLate = existing?.late_count ?? 0;
    const prevTotal = prevOn + prevLate;

    const nextOn = onTimeProvided ? o : prevOn;
    const nextTotal = totalProvided ? t : Math.max(prevTotal, nextOn);

    if (nextOn > nextTotal) {
      setSubmitting(false);
      return toast.error("Before 07:20 cannot exceed total present.");
    }

    // Only warn on true overwrite of an existing NON-EMPTY value with a different value.
    // Filling in a previously-empty (0) field does not need confirmation.
    const overwritingOnTime = onTimeProvided && prevOn > 0 && prevOn !== nextOn;
    const overwritingTotal = totalProvided && prevTotal > 0 && prevTotal !== nextTotal;
    if (existing && (overwritingOnTime || overwritingTotal)) {
      const ok = window.confirm(
        `Today's record already has values (before 07:20: ${prevOn}, total: ${prevTotal}). Overwrite with new values?`,
      );
      if (!ok) { setSubmitting(false); return; }
    }

    const { error } = await supabase
      .from("attendance")
      .upsert(
        {
          classroom_id: classroomId,
          attendance_date: todayISO(),
          on_time_count: nextOn,
          late_count: nextTotal - nextOn,
        },
        { onConflict: "classroom_id,attendance_date" },
      );
    setSubmitting(false);
    if (error) return toast.error(error.message);
    toast.success("Attendance saved for today.");
    setSuccess(true);
  }

  return (
    <main className="mx-auto max-w-lg px-4 py-8 sm:py-12">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          Morning Attendance
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {new Date().toLocaleDateString(undefined, {
            weekday: "long", year: "numeric", month: "long", day: "numeric",
          })}
        </p>
      </div>

      {success && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-foreground">
          <CheckCircle2 className="h-5 w-5 text-primary" />
          Today's attendance has been recorded.
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="rounded-2xl border bg-card p-5 shadow-sm sm:p-6"
      >
        <div className="mb-4">
          <span className="mb-1.5 block text-sm font-medium text-foreground">Classroom</span>
          <div className="grid grid-cols-2 gap-2">
            <div className={`flex h-12 items-center justify-center rounded-xl border px-3 text-base font-medium ${
              matched ? "bg-primary/5 text-foreground" : "bg-muted/40 text-muted-foreground"
            }`}>
              {loading ? "Loading…" : matched ? matched.classroom_name : "—"}
            </div>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="off"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Code"
              disabled={loading}
              className="h-12 w-full rounded-xl border bg-background px-3 text-base outline-none focus:ring-2 focus:ring-primary"
              required
            />
          </div>
          {code.trim() && !matched && !loading && (
            <p className="mt-1.5 text-xs text-destructive">No classroom matches that code.</p>
          )}
        </div>

        <Field label="Students at 07:20">
          <input
            type="number" min={0} step={1} inputMode="numeric"
            value={onTime} onChange={(e) => setOnTime(e.target.value)}
            className="h-12 w-full rounded-xl border bg-background px-3 text-base outline-none focus:ring-2 focus:ring-primary"
          />
        </Field>

        <Field label="Students at 08:20">
          <input
            type="number" min={0} step={1} inputMode="numeric"
            value={total} onChange={(e) => setTotal(e.target.value)}
            className="h-12 w-full rounded-xl border bg-background px-3 text-base outline-none focus:ring-2 focus:ring-primary"
          />
        </Field>

        <button
          type="submit" disabled={submitting || !matched}
          className="mt-2 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary text-base font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60"
        >
          {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
          Submit attendance
        </button>

        <p className="mt-3 text-center text-xs text-muted-foreground">
          You can submit either field separately. Re-submitting updates today's record.
        </p>
      </form>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="mb-4 block">
      <span className="mb-1.5 block text-sm font-medium text-foreground">{label}</span>
      {children}
    </label>
  );
}
