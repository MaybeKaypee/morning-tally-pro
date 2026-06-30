import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
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

type Classroom = { id: string; classroom_name: string };

function todayISO() {
  const d = new Date();
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 10);
}

function AttendanceForm() {
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [classroomId, setClassroomId] = useState("");
  const [onTime, setOnTime] = useState("");
  const [total, setTotal] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    supabase
      .from("classrooms")
      .select("id, classroom_name")
      .eq("active", true)
      .then(({ data, error }) => {
        if (error) toast.error(error.message);
        else setClassrooms((data ?? []).sort((a, b) => classroomCompare(a.classroom_name, b.classroom_name)));
        setLoading(false);
      });
  }, []);

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
          setOnTime(String(data.on_time_count));
          setTotal(String(data.on_time_count + data.late_count));
        } else {
          setOnTime(""); setTotal("");
        }
      });
  }, [classroomId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSuccess(false);
    if (!classroomId) return toast.error("Please choose a classroom.");

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

    // Merge with any existing record for today so each field can be submitted separately.
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
    // If only the early count is provided, lift the total to at least that count
    // so partial submissions are accepted before the total is entered.
    const nextTotal = totalProvided ? t : Math.max(prevTotal, nextOn);

    if (nextOn > nextTotal) {
      setSubmitting(false);
      return toast.error("Before 07:20 cannot exceed total present.");
    }

    // Confirm overwrite if existing values differ from what we're about to save.
    if (existing && (existing.on_time_count !== nextOn || existing.late_count !== nextTotal - nextOn)) {
      const ok = window.confirm(
        `Today's record already exists for this classroom (before 07:20: ${existing.on_time_count}, total: ${existing.on_time_count + existing.late_count}). Overwrite with new values?`,
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
        <Field label="Classroom">
          <select
            value={classroomId}
            onChange={(e) => setClassroomId(e.target.value)}
            disabled={loading}
            className="h-12 w-full rounded-xl border bg-background px-3 text-base outline-none focus:ring-2 focus:ring-primary"
            required
          >
            <option value="">{loading ? "Loading…" : "Select classroom"}</option>
            {classrooms.map((c) => (
              <option key={c.id} value={c.id}>
                {c.classroom_name}
              </option>
            ))}
          </select>
        </Field>

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
          type="submit" disabled={submitting}
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
