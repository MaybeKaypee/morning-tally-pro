import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Submit Attendance — Morning Attendance" },
      { name: "description", content: "Submit today's morning attendance for your classroom." },
    ],
  }),
  component: AttendanceForm,
});

type Classroom = { id: string; classroom_name: string; total_students: number };

function todayISO() {
  const d = new Date();
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 10);
}

function AttendanceForm() {
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [classroomId, setClassroomId] = useState("");
  const [onTime, setOnTime] = useState("");
  const [late, setLate] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    supabase
      .from("classrooms")
      .select("id, classroom_name, total_students")
      .eq("active", true)
      .order("classroom_name")
      .then(({ data, error }) => {
        if (error) toast.error(error.message);
        else setClassrooms(data ?? []);
        setLoading(false);
      });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSuccess(false);
    if (!classroomId) return toast.error("Please choose a classroom.");
    const o = Number(onTime);
    const l = Number(late);
    if (!Number.isInteger(o) || o < 0 || !Number.isInteger(l) || l < 0) {
      return toast.error("Counts must be non-negative whole numbers.");
    }
    const classroom = classrooms.find((c) => c.id === classroomId);
    if (classroom && o + l > classroom.total_students) {
      return toast.error(`Total exceeds classroom size (${classroom.total_students}).`);
    }

    setSubmitting(true);
    const { error } = await supabase
      .from("attendance")
      .upsert(
        {
          classroom_id: classroomId,
          attendance_date: todayISO(),
          on_time_count: o,
          late_count: l,
        },
        { onConflict: "classroom_id,attendance_date" },
      );
    setSubmitting(false);
    if (error) return toast.error(error.message);
    toast.success("Attendance saved for today.");
    setSuccess(true);
    setOnTime("");
    setLate("");
    setClassroomId("");
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
                {c.classroom_name} ({c.total_students} students)
              </option>
            ))}
          </select>
        </Field>

        <Field label="Arrived before 07:20">
          <input
            type="number" min={0} step={1} inputMode="numeric"
            value={onTime} onChange={(e) => setOnTime(e.target.value)} required
            className="h-12 w-full rounded-xl border bg-background px-3 text-base outline-none focus:ring-2 focus:ring-primary"
          />
        </Field>

        <Field label="Arrived between 07:20 – 08:20">
          <input
            type="number" min={0} step={1} inputMode="numeric"
            value={late} onChange={(e) => setLate(e.target.value)} required
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
          One submission per classroom per day. Re-submitting updates today's record.
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
