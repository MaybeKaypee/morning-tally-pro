import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { classroomCompare } from "@/lib/sort";
import { ConfirmDialog } from "@/components/ConfirmDialog";

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
type Existing = { on_time_count: number; late_count: number | null } | null;

const CODE_STORAGE_KEY = "attendance:lastCode";

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
  const [existing, setExisting] = useState<Existing>(null);
  const [todayLabel, setTodayLabel] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const pendingSubmit = useMemo(() => ({ current: null as null | (() => Promise<void>) }), []);

  // Render date only after mount to avoid SSR/client locale mismatch.
  useEffect(() => {
    setTodayLabel(new Date().toLocaleDateString(undefined, {
      weekday: "long", year: "numeric", month: "long", day: "numeric",
    }));
  }, []);

  // Restore last-used code from localStorage.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(CODE_STORAGE_KEY);
      if (saved) setCode(saved);
    } catch { /* ignore */ }
  }, []);

  // Persist code.
  useEffect(() => {
    try {
      if (code) localStorage.setItem(CODE_STORAGE_KEY, code);
    } catch { /* ignore */ }
  }, [code]);

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
    if (!classroomId) { setOnTime(""); setTotal(""); setExisting(null); return; }
    supabase
      .from("attendance")
      .select("on_time_count, late_count")
      .eq("classroom_id", classroomId)
      .eq("attendance_date", todayISO())
      .maybeSingle()
      .then(({ data }) => {
        setExisting(data ?? null);
        if (data) {
          setOnTime(data.on_time_count > 0 ? String(data.on_time_count) : "");
          if (data.late_count == null) setTotal("");
          else setTotal(String(data.on_time_count + data.late_count));
        } else {
          setOnTime(""); setTotal("");
        }
      });
  }, [classroomId]);

  async function doSave(nextOn: number, nextLate: number | null): Promise<void> {
    setSubmitting(true);
    const { error } = await supabase
      .from("attendance")
      .upsert(
        {
          classroom_id: classroomId,
          attendance_date: todayISO(),
          on_time_count: nextOn,
          late_count: nextLate,
        },
        { onConflict: "classroom_id,attendance_date" },
      );
    setSubmitting(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Attendance saved for today.");
    setSuccess(true);
    setExisting({ on_time_count: nextOn, late_count: nextLate });
  }

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
      return toast.error("Before 07:45 must be a non-negative whole number.");
    }
    if (totalProvided && (!Number.isInteger(t) || t < 0)) {
      return toast.error("Total present must be a non-negative whole number.");
    }

    const prevOn = existing?.on_time_count ?? 0;
    const prevLate = existing?.late_count ?? null;

    // Rule 1: cannot submit only the total without a 07:45 count already in the database.
    if (totalProvided && !onTimeProvided && prevOn === 0) {
      return toast.error("Enter the 07:45 count first — the 08:20 total can only be added after.");
    }

    const nextOn = onTimeProvided ? o : prevOn;
    let nextLate: number | null;
    if (totalProvided) {
      if (nextOn > t) {
        return toast.error("Before 07:45 cannot exceed total present.");
      }
      nextLate = t - nextOn;
    } else {
      nextLate = prevLate; // preserve (may be null → still not complete)
    }

    // Only warn on overwrite of an existing NON-EMPTY value with a DIFFERENT value.
    const overwritingOnTime = onTimeProvided && prevOn > 0 && prevOn !== nextOn;
    const overwritingTotal =
      totalProvided && prevLate != null && (prevOn + prevLate) !== (nextOn + (nextLate ?? 0));
    if (existing && (overwritingOnTime || overwritingTotal)) {
      pendingSubmit.current = () => doSave(nextOn, nextLate);
      setConfirmOpen(true);
      return;
    }

    await doSave(nextOn, nextLate);
  }

  return (
    <main className="mx-auto max-w-lg px-4 py-8 sm:py-12">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          Morning Attendance
        </h1>
        <p className="mt-1 text-sm text-muted-foreground" suppressHydrationWarning>
          {todayLabel || "\u00A0"}
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
          <div className="grid grid-cols-[1fr_2fr] gap-2">
            <div className={`flex h-12 items-center justify-center rounded-xl border px-3 text-base font-medium ${
              matched ? "bg-primary/5 text-foreground" : "bg-muted/40 text-muted-foreground"
            }`}>
              {loading ? "…" : matched ? matched.classroom_name : "—"}
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
          Submit 07:20 first; you can add 08:20 later. Re-submitting updates today's record.
        </p>
      </form>

      <ConfirmDialog
        open={confirmOpen}
        title="Overwrite today's record?"
        message="Today's record already has values. Replacing them will overwrite the previous entry."
        confirmLabel="Overwrite"
        onCancel={() => { setConfirmOpen(false); pendingSubmit.current = null; }}
        onConfirm={async () => {
          const fn = pendingSubmit.current;
          setConfirmOpen(false);
          pendingSubmit.current = null;
          if (fn) await fn();
        }}
      />
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
