import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, Pencil, Plus, Trash2, LogOut, History, ListChecks, School, Undo2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { classroomCompare } from "@/lib/sort";
import { formatShortDate } from "@/lib/date-format";
import { ConfirmDialog } from "@/components/ConfirmDialog";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Admin — Morning Attendance" }] }),
  component: AdminPage,
});

type Classroom = { id: string; classroom_name: string; active: boolean; code: string | null };
type Attendance = {
  id: string;
  classroom_id: string;
  attendance_date: string;
  on_time_count: number;
  late_count: number | null;
  created_at: string;
  updated_at: string;
};
type HistoryRow = {
  id: string;
  attendance_id: string | null;
  classroom_id: string;
  attendance_date: string;
  on_time_count: number;
  late_count: number | null;
  action: string;
  changed_at: string;
  changed_by: string | null;
};

type Tab = "classrooms" | "responses" | "history";

function AdminPage() {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [tab, setTab] = useState<Tab>("classrooms");

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { navigate({ to: "/auth" }); return; }
      const { data: roles } = await supabase
        .from("user_roles").select("role").eq("user_id", session.user.id);
      setIsAdmin(!!roles?.some((r) => r.role === "admin"));
      setChecking(false);
    })();
  }, [navigate]);

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  }

  if (checking) {
    return <main className="mx-auto max-w-md px-4 py-12 text-center text-muted-foreground">
      <Loader2 className="mx-auto h-6 w-6 animate-spin" />
    </main>;
  }
  if (!isAdmin) {
    return (
      <main className="mx-auto max-w-md px-4 py-12 text-center">
        <h1 className="text-xl font-semibold">Not authorized</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Your account does not have admin access.
        </p>
        <button onClick={signOut} className="mt-4 rounded-xl border px-4 py-2 text-sm hover:bg-accent">Sign out</button>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Admin</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage classrooms, responses, and history.</p>
        </div>
        <button onClick={signOut} className="flex h-10 items-center gap-2 rounded-xl border px-4 text-sm hover:bg-accent">
          <LogOut className="h-4 w-4" /> Sign out
        </button>
      </header>

      <div className="mb-4 inline-flex rounded-xl border bg-card p-1">
        <TabButton active={tab === "classrooms"} onClick={() => setTab("classrooms")} icon={<School className="h-4 w-4" />}>Classrooms</TabButton>
        <TabButton active={tab === "responses"} onClick={() => setTab("responses")} icon={<ListChecks className="h-4 w-4" />}>Responses</TabButton>
        <TabButton active={tab === "history"} onClick={() => setTab("history")} icon={<History className="h-4 w-4" />}>History</TabButton>
      </div>

      {tab === "classrooms" && <ClassroomsPanel />}
      {tab === "responses" && <ResponsesPanel />}
      {tab === "history" && <HistoryPanel />}
    </main>
  );
}

function TabButton({ active, onClick, icon, children }: { active: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
      active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
    }`}>{icon}{children}</button>
  );
}

/* -------- Classrooms -------- */

function ClassroomsPanel() {
  const [rows, setRows] = useState<Classroom[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Classroom | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Classroom | null>(null);

  async function refresh() {
    setLoading(true);
    const { data, error } = await supabase.from("classrooms").select("id, classroom_name, active, code");
    if (error) toast.error(error.message);
    else setRows((data ?? []).sort((a, b) => classroomCompare(a.classroom_name, b.classroom_name)));
    setLoading(false);
  }
  useEffect(() => { refresh(); }, []);

  async function confirmDelete() {
    const c = pendingDelete;
    setPendingDelete(null);
    if (!c) return;
    const { error } = await supabase.from("classrooms").delete().eq("id", c.id);
    if (error) return toast.error(error.message);
    toast.success("Classroom deleted.");
    refresh();
  }

  return (
    <>
      <div className="mb-3 flex justify-end">
        <button onClick={() => { setEditing(null); setShowForm(true); }}
          className="flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90">
          <Plus className="h-4 w-4" /> Add classroom
        </button>
      </div>
      <section className="overflow-hidden rounded-2xl border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Classroom</th>
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={3} className="px-4 py-8 text-center text-muted-foreground">Loading…</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={3} className="px-4 py-8 text-center text-muted-foreground">No classrooms.</td></tr>
              ) : rows.map((c) => (
                <tr key={c.id} className="border-t">
                  <td className="px-4 py-3 font-medium">{c.classroom_name}</td>
                  <td className="px-4 py-3 font-mono text-sm">{c.code ?? <span className="text-muted-foreground">—</span>}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex gap-1">
                      <button onClick={() => { setEditing(c); setShowForm(true); }} className="rounded-lg p-2 hover:bg-accent" title="Edit"><Pencil className="h-4 w-4" /></button>
                      <button onClick={() => setPendingDelete(c)} className="rounded-lg p-2 text-destructive hover:bg-destructive/10" title="Delete"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      {showForm && (
        <ClassroomDialog initial={editing} onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); refresh(); }} />
      )}
      <ConfirmDialog
        open={!!pendingDelete}
        destructive
        title="Delete classroom?"
        message={pendingDelete ? `"${pendingDelete.classroom_name}" and all of its attendance history will be deleted.` : ""}
        confirmLabel="Delete"
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </>
  );
}


function ClassroomDialog({ initial, onClose, onSaved }: { initial: Classroom | null; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(initial?.classroom_name ?? "");
  const [code, setCode] = useState(initial?.code ?? "");
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return toast.error("Name is required.");
    setBusy(true);
    const codeVal = code.trim() === "" ? null : code.trim();
    const { error } = initial
      ? await supabase.from("classrooms").update({ classroom_name: name.trim(), code: codeVal }).eq("id", initial.id)
      : await supabase.from("classrooms").insert({ classroom_name: name.trim(), code: codeVal, active: true });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(initial ? "Classroom updated." : "Classroom added.");
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/30 p-4 sm:items-center">
      <form onSubmit={save} className="w-full max-w-md rounded-2xl border bg-card p-5 shadow-xl sm:p-6">
        <h2 className="text-lg font-semibold">{initial ? "Edit classroom" : "Add classroom"}</h2>
        <label className="mt-4 mb-4 block">
          <span className="mb-1.5 block text-sm font-medium">Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} required
            className="h-11 w-full rounded-xl border bg-background px-3 outline-none focus:ring-2 focus:ring-primary" />
        </label>
        <label className="mb-4 block">
          <span className="mb-1.5 block text-sm font-medium">Code</span>
          <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. 501"
            className="h-11 w-full rounded-xl border bg-background px-3 font-mono outline-none focus:ring-2 focus:ring-primary" />
          <span className="mt-1 block text-xs text-muted-foreground">Teachers type this to pick the classroom on the form.</span>
        </label>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="h-10 rounded-xl border px-4 text-sm hover:bg-accent">Cancel</button>
          <button type="submit" disabled={busy} className="flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60">
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            Save
          </button>
        </div>
      </form>
    </div>
  );
}


/* -------- Responses -------- */

function ResponsesPanel() {
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [rows, setRows] = useState<Attendance[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Attendance | null>(null);
  const [creating, setCreating] = useState(false);
  const [dateFilter, setDateFilter] = useState(todayISO());

  async function refresh() {
    setLoading(true);
    const [cr, ar] = await Promise.all([
      supabase.from("classrooms").select("id, classroom_name, active, code"),
      supabase.from("attendance").select("*").order("attendance_date", { ascending: false }).order("updated_at", { ascending: false }),
    ]);
    setClassrooms(cr.data ?? []);
    setRows(ar.data ?? []);
    setLoading(false);
  }
  useEffect(() => { refresh(); }, []);

  const nameById = useMemo(() => Object.fromEntries(classrooms.map((c) => [c.id, c.classroom_name])), [classrooms]);
  const visibleRows = useMemo(
    () => dateFilter ? rows.filter((r) => r.attendance_date === dateFilter) : rows,
    [rows, dateFilter],
  );

  async function remove(r: Attendance) {
    if (!confirm(`Delete this response (${nameById[r.classroom_id]} • ${formatShortDate(r.attendance_date)})?`)) return;
    const { error } = await supabase.from("attendance").delete().eq("id", r.id);
    if (error) return toast.error(error.message);
    toast.success("Response deleted.");
    refresh();
  }

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <label className="text-xs text-muted-foreground">Filter by date</label>
          <input type="date" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)}
            className="h-9 rounded-xl border bg-card px-3 text-sm" />
          {dateFilter && (
            <button type="button" onClick={() => setDateFilter("")}
              className="h-9 rounded-xl border px-3 text-xs hover:bg-accent">Clear</button>
          )}
        </div>
        <button onClick={() => setCreating(true)}
          className="flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90">
          <Plus className="h-4 w-4" /> Add response
        </button>
      </div>
      <section className="overflow-hidden rounded-2xl border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Classroom</th>
                <th className="px-4 py-3 text-right">Before 07:45</th>
                <th className="px-4 py-3 text-right">07:45–08:20</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3">Submitted</th>
                <th className="px-4 py-3">Last updated</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">Loading…</td></tr>
              ) : visibleRows.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">No responses{dateFilter ? " for this date" : " yet"}.</td></tr>
              ) : visibleRows.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="px-4 py-3">{formatShortDate(r.attendance_date)}</td>
                  <td className="px-4 py-3 font-medium">{nameById[r.classroom_id] ?? "—"}</td>
                  <td className="px-4 py-3 text-right">{r.on_time_count}</td>
                  <td className="px-4 py-3 text-right">{r.late_count == null ? "—" : r.late_count}</td>
                  <td className="px-4 py-3 text-right">{r.late_count == null ? "—" : r.on_time_count + r.late_count}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{fmt(r.created_at)}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{fmt(r.updated_at)}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex gap-1">
                      <button onClick={() => setEditing(r)} className="rounded-lg p-2 hover:bg-accent" title="Edit"><Pencil className="h-4 w-4" /></button>
                      <button onClick={() => remove(r)} className="rounded-lg p-2 text-destructive hover:bg-destructive/10" title="Delete"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      {editing && (
        <ResponseDialog row={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); refresh(); }} />
      )}
      {creating && (
        <NewResponseDialog classrooms={classrooms} onClose={() => setCreating(false)} onSaved={() => { setCreating(false); refresh(); }} />
      )}
    </>
  );
}

function NewResponseDialog({ classrooms, onClose, onSaved }: { classrooms: Classroom[]; onClose: () => void; onSaved: () => void }) {
  const sorted = useMemo(
    () => [...classrooms].sort((a, b) => classroomCompare(a.classroom_name, b.classroom_name)),
    [classrooms],
  );
  const [classroomId, setClassroomId] = useState(sorted[0]?.id ?? "");
  const today = new Date();
  const tz = today.getTimezoneOffset() * 60000;
  const [date, setDate] = useState(new Date(today.getTime() - tz).toISOString().slice(0, 10));
  const [onTime, setOnTime] = useState("");
  const [late, setLate] = useState("");
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!classroomId) return toast.error("Pick a classroom.");
    if (!date) return toast.error("Pick a date.");
    const o = onTime === "" ? 0 : Number(onTime);
    const totalBlank = late === "";
    const totalVal = totalBlank ? null : Number(late);
    if (!Number.isInteger(o) || o < 0) return toast.error("Before 07:45 must be a non-negative whole number.");
    if (totalVal !== null && (!Number.isInteger(totalVal) || totalVal < 0)) return toast.error("Total present must be a non-negative whole number.");
    if (totalVal !== null && o > totalVal) return toast.error("Before 07:45 cannot exceed total present.");
    const nextLate: number | null = totalVal === null ? null : totalVal - o;
    setBusy(true);
    const { data: existing } = await supabase.from("attendance")
      .select("id, on_time_count, late_count")
      .eq("classroom_id", classroomId).eq("attendance_date", date).maybeSingle();
    if (existing && (existing.on_time_count !== o || existing.late_count !== nextLate)) {
      if (!confirm(`A response already exists for ${formatShortDate(date)}. Overwrite it?`)) {
        setBusy(false); return;
      }
    }
    const { error } = await supabase.from("attendance").upsert(
      { classroom_id: classroomId, attendance_date: date, on_time_count: o, late_count: nextLate },
      { onConflict: "classroom_id,attendance_date" },
    );
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Response saved.");
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/30 p-4 sm:items-center">
      <form onSubmit={save} className="w-full max-w-md rounded-2xl border bg-card p-5 shadow-xl sm:p-6">
        <h2 className="text-lg font-semibold">Add response</h2>
        <label className="mt-4 mb-3 block">
          <span className="mb-1.5 block text-sm font-medium">Classroom</span>
          <select value={classroomId} onChange={(e) => setClassroomId(e.target.value)} required
            className="h-11 w-full rounded-xl border bg-background px-3 outline-none focus:ring-2 focus:ring-primary">
            {sorted.map((c) => <option key={c.id} value={c.id}>{c.classroom_name}</option>)}
          </select>
        </label>
        <label className="mb-3 block">
          <span className="mb-1.5 block text-sm font-medium">Date</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required
            className="h-11 w-full rounded-xl border bg-background px-3 outline-none focus:ring-2 focus:ring-primary" />
        </label>
        <label className="mb-3 block">
          <span className="mb-1.5 block text-sm font-medium">Before 07:45</span>
          <input type="number" min={0} step={1} value={onTime} onChange={(e) => setOnTime(e.target.value)}
            className="h-11 w-full rounded-xl border bg-background px-3 outline-none focus:ring-2 focus:ring-primary" />
        </label>
        <label className="mb-4 block">
          <span className="mb-1.5 block text-sm font-medium">Total present (07:45–08:20, incl. before)</span>
          <input type="number" min={0} step={1} value={late} onChange={(e) => setLate(e.target.value)}
            className="h-11 w-full rounded-xl border bg-background px-3 outline-none focus:ring-2 focus:ring-primary" />
        </label>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="h-10 rounded-xl border px-4 text-sm hover:bg-accent">Cancel</button>
          <button type="submit" disabled={busy} className="flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60">
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            Save
          </button>
        </div>
      </form>
    </div>
  );
}

function ResponseDialog({ row, onClose, onSaved }: { row: Attendance; onClose: () => void; onSaved: () => void }) {
  const [onTime, setOnTime] = useState(String(row.on_time_count));
  const [late, setLate] = useState(row.late_count == null ? "" : String(row.late_count));
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const o = Number(onTime);
    const lateBlank = late.trim() === "";
    const l = lateBlank ? null : Number(late);
    if (!Number.isInteger(o) || o < 0) return toast.error("Before 07:45 must be a non-negative whole number.");
    if (l !== null && (!Number.isInteger(l) || l < 0)) return toast.error("07:45–08:20 must be a non-negative whole number.");
    setBusy(true);
    const { error } = await supabase.from("attendance")
      .update({ on_time_count: o, late_count: l }).eq("id", row.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Response updated.");
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/30 p-4 sm:items-center">
      <form onSubmit={save} className="w-full max-w-md rounded-2xl border bg-card p-5 shadow-xl sm:p-6">
        <h2 className="text-lg font-semibold">Edit response</h2>
        <p className="mt-1 text-xs text-muted-foreground">{formatShortDate(row.attendance_date)}</p>
        <label className="mt-4 mb-3 block">
          <span className="mb-1.5 block text-sm font-medium">Before 07:45</span>
          <input type="number" min={0} step={1} value={onTime} onChange={(e) => setOnTime(e.target.value)} required
            className="h-11 w-full rounded-xl border bg-background px-3 outline-none focus:ring-2 focus:ring-primary" />
        </label>
        <label className="mb-4 block">
          <span className="mb-1.5 block text-sm font-medium">Between 07:45–08:20</span>
          <input type="number" min={0} step={1} value={late} onChange={(e) => setLate(e.target.value)}
            placeholder="Leave blank if not yet counted"
            className="h-11 w-full rounded-xl border bg-background px-3 outline-none focus:ring-2 focus:ring-primary" />
        </label>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="h-10 rounded-xl border px-4 text-sm hover:bg-accent">Cancel</button>
          <button type="submit" disabled={busy} className="flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60">
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            Save
          </button>
        </div>
      </form>
    </div>
  );
}

/* -------- History -------- */

function HistoryPanel() {
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState(todayISO());

  async function refresh() {
    setLoading(true);
    const [cr, hr] = await Promise.all([
      supabase.from("classrooms").select("id, classroom_name, active, code"),
      supabase.from("attendance_history").select("*").order("changed_at", { ascending: false }).limit(500),
    ]);
    setClassrooms(cr.data ?? []);
    setRows(hr.data ?? []);
    setLoading(false);
  }
  useEffect(() => { refresh(); }, []);

  const nameById = useMemo(() => Object.fromEntries(classrooms.map((c) => [c.id, c.classroom_name])), [classrooms]);
  const visibleRows = useMemo(
    () => dateFilter ? rows.filter((r) => r.attendance_date === dateFilter) : rows,
    [rows, dateFilter],
  );

  async function revert(r: HistoryRow) {
    const name = nameById[r.classroom_id] ?? "this classroom";
    if (!confirm(`Revert ${name} on ${formatShortDate(r.attendance_date)} to: before 07:45 = ${r.on_time_count}, 07:45–08:20 = ${r.late_count}?`)) return;
    const { error } = await supabase.from("attendance").upsert(
      {
        classroom_id: r.classroom_id,
        attendance_date: r.attendance_date,
        on_time_count: r.on_time_count,
        late_count: r.late_count,
      },
      { onConflict: "classroom_id,attendance_date" },
    );
    if (error) return toast.error(error.message);
    toast.success("Reverted to this version.");
    refresh();
  }

  return (
    <>
      <div className="mb-3 flex items-center gap-2">
        <label className="text-xs text-muted-foreground">Filter by date</label>
        <input type="date" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)}
          className="h-9 rounded-xl border bg-card px-3 text-sm" />
        {dateFilter && (
          <button type="button" onClick={() => setDateFilter("")}
            className="h-9 rounded-xl border px-3 text-xs hover:bg-accent">Clear</button>
        )}
      </div>
      <section className="overflow-hidden rounded-2xl border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">When</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Classroom</th>
                <th className="px-4 py-3">For date</th>
                <th className="px-4 py-3 text-right">Before 07:45</th>
                <th className="px-4 py-3 text-right">07:45–08:20</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">Loading…</td></tr>
              ) : visibleRows.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">No history{dateFilter ? " for this date" : " yet"}.</td></tr>
              ) : visibleRows.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="px-4 py-3 text-xs text-muted-foreground">{fmt(r.changed_at)}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-1">
                      <ActionBadge action={r.action} />
                      {r.changed_by && (
                        <span className="inline-flex rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">Admin</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 font-medium">{nameById[r.classroom_id] ?? "—"}</td>
                  <td className="px-4 py-3">{formatShortDate(r.attendance_date)}</td>
                  <td className="px-4 py-3 text-right">{r.on_time_count}</td>
                  <td className="px-4 py-3 text-right">{r.late_count == null ? "—" : r.late_count}</td>
                  <td className="px-4 py-3 text-right">{r.late_count == null ? "—" : r.on_time_count + r.late_count}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => revert(r)} className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs hover:bg-accent" title="Restore this version">
                      <Undo2 className="h-3.5 w-3.5" /> Revert
                    </button>
                  </td>
                </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
    </>
  );
}


function fmt(ts: string) {
  const d = new Date(ts);
  return d.toLocaleString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function todayISO() {
  const d = new Date();
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 10);
}

function ActionBadge({ action }: { action: string }) {
  if (action === "insert") {
    return <span className="inline-flex rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">Inserted</span>;
  }
  if (action === "submit") {
    return <span className="inline-flex rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">Submitted</span>;
  }
  return <span className="inline-flex rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400">Overwritten</span>;
}
