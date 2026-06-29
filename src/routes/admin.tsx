import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, Pencil, Plus, Trash2, LogOut, History, ListChecks, School } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { classroomCompare } from "@/lib/sort";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Admin — Morning Attendance" }] }),
  component: AdminPage,
});

type Classroom = { id: string; classroom_name: string; active: boolean };
type Attendance = {
  id: string;
  classroom_id: string;
  attendance_date: string;
  on_time_count: number;
  late_count: number;
  created_at: string;
  updated_at: string;
};
type HistoryRow = {
  id: string;
  attendance_id: string | null;
  classroom_id: string;
  attendance_date: string;
  on_time_count: number;
  late_count: number;
  action: string;
  changed_at: string;
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

  async function refresh() {
    setLoading(true);
    const { data, error } = await supabase.from("classrooms").select("id, classroom_name, active");
    if (error) toast.error(error.message);
    else setRows((data ?? []).sort((a, b) => classroomCompare(a.classroom_name, b.classroom_name)));
    setLoading(false);
  }
  useEffect(() => { refresh(); }, []);

  async function toggleActive(c: Classroom) {
    const { error } = await supabase.from("classrooms").update({ active: !c.active }).eq("id", c.id);
    if (error) return toast.error(error.message);
    refresh();
  }
  async function remove(c: Classroom) {
    if (!confirm(`Delete "${c.classroom_name}"? This also deletes its attendance history.`)) return;
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
                <th className="px-4 py-3">Status</th>
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
                  <td className="px-4 py-3">
                    <button onClick={() => toggleActive(c)} className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${
                      c.active ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                    }`}>
                      <span className={`h-2 w-2 rounded-full ${c.active ? "bg-primary" : "bg-muted-foreground"}`} />
                      {c.active ? "Active" : "Disabled"}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex gap-1">
                      <button onClick={() => { setEditing(c); setShowForm(true); }} className="rounded-lg p-2 hover:bg-accent" title="Edit"><Pencil className="h-4 w-4" /></button>
                      <button onClick={() => remove(c)} className="rounded-lg p-2 text-destructive hover:bg-destructive/10" title="Delete"><Trash2 className="h-4 w-4" /></button>
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
    </>
  );
}

function ClassroomDialog({ initial, onClose, onSaved }: { initial: Classroom | null; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(initial?.classroom_name ?? "");
  const [active, setActive] = useState(initial?.active ?? true);
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return toast.error("Name is required.");
    setBusy(true);
    const payload = { classroom_name: name.trim(), active };
    const { error } = initial
      ? await supabase.from("classrooms").update(payload).eq("id", initial.id)
      : await supabase.from("classrooms").insert(payload);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(initial ? "Classroom updated." : "Classroom added.");
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/30 p-4 sm:items-center">
      <form onSubmit={save} className="w-full max-w-md rounded-2xl border bg-card p-5 shadow-xl sm:p-6">
        <h2 className="text-lg font-semibold">{initial ? "Edit classroom" : "Add classroom"}</h2>
        <label className="mt-4 mb-3 block">
          <span className="mb-1.5 block text-sm font-medium">Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} required
            className="h-11 w-full rounded-xl border bg-background px-3 outline-none focus:ring-2 focus:ring-primary" />
        </label>
        <label className="mb-4 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="h-4 w-4" />
          Active (visible on attendance form)
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

  async function refresh() {
    setLoading(true);
    const [cr, ar] = await Promise.all([
      supabase.from("classrooms").select("id, classroom_name, active"),
      supabase.from("attendance").select("*").order("attendance_date", { ascending: false }).order("updated_at", { ascending: false }),
    ]);
    setClassrooms(cr.data ?? []);
    setRows(ar.data ?? []);
    setLoading(false);
  }
  useEffect(() => { refresh(); }, []);

  const nameById = useMemo(() => Object.fromEntries(classrooms.map((c) => [c.id, c.classroom_name])), [classrooms]);

  async function remove(r: Attendance) {
    if (!confirm(`Delete this response (${nameById[r.classroom_id]} • ${r.attendance_date})?`)) return;
    const { error } = await supabase.from("attendance").delete().eq("id", r.id);
    if (error) return toast.error(error.message);
    toast.success("Response deleted.");
    refresh();
  }

  return (
    <>
      <section className="overflow-hidden rounded-2xl border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Classroom</th>
                <th className="px-4 py-3 text-right">Before 07:20</th>
                <th className="px-4 py-3 text-right">07:20–08:20</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3">Submitted</th>
                <th className="px-4 py-3">Last updated</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">Loading…</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">No responses yet.</td></tr>
              ) : rows.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="px-4 py-3">{r.attendance_date}</td>
                  <td className="px-4 py-3 font-medium">{nameById[r.classroom_id] ?? "—"}</td>
                  <td className="px-4 py-3 text-right">{r.on_time_count}</td>
                  <td className="px-4 py-3 text-right">{r.late_count}</td>
                  <td className="px-4 py-3 text-right">{r.on_time_count + r.late_count}</td>
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
    </>
  );
}

function ResponseDialog({ row, onClose, onSaved }: { row: Attendance; onClose: () => void; onSaved: () => void }) {
  const [onTime, setOnTime] = useState(String(row.on_time_count));
  const [late, setLate] = useState(String(row.late_count));
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const o = Number(onTime), l = Number(late);
    if (!Number.isInteger(o) || o < 0 || !Number.isInteger(l) || l < 0) {
      return toast.error("Counts must be non-negative whole numbers.");
    }
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
        <p className="mt-1 text-xs text-muted-foreground">{row.attendance_date}</p>
        <label className="mt-4 mb-3 block">
          <span className="mb-1.5 block text-sm font-medium">Before 07:20</span>
          <input type="number" min={0} step={1} value={onTime} onChange={(e) => setOnTime(e.target.value)} required
            className="h-11 w-full rounded-xl border bg-background px-3 outline-none focus:ring-2 focus:ring-primary" />
        </label>
        <label className="mb-4 block">
          <span className="mb-1.5 block text-sm font-medium">Between 07:20–08:20</span>
          <input type="number" min={0} step={1} value={late} onChange={(e) => setLate(e.target.value)} required
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

  useEffect(() => {
    (async () => {
      const [cr, hr] = await Promise.all([
        supabase.from("classrooms").select("id, classroom_name, active"),
        supabase.from("attendance_history").select("*").order("changed_at", { ascending: false }).limit(500),
      ]);
      setClassrooms(cr.data ?? []);
      setRows(hr.data ?? []);
      setLoading(false);
    })();
  }, []);

  const nameById = useMemo(() => Object.fromEntries(classrooms.map((c) => [c.id, c.classroom_name])), [classrooms]);

  return (
    <section className="overflow-hidden rounded-2xl border bg-card shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3">When</th>
              <th className="px-4 py-3">Action</th>
              <th className="px-4 py-3">Classroom</th>
              <th className="px-4 py-3">For date</th>
              <th className="px-4 py-3 text-right">Before 07:20</th>
              <th className="px-4 py-3 text-right">07:20–08:20</th>
              <th className="px-4 py-3 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">No history yet.</td></tr>
            ) : rows.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="px-4 py-3 text-xs text-muted-foreground">{fmt(r.changed_at)}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                    r.action === "insert" ? "bg-primary/10 text-primary" : "bg-amber-500/10 text-amber-700 dark:text-amber-400"
                  }`}>
                    {r.action === "insert" ? "Submitted" : "Overwritten"}
                  </span>
                </td>
                <td className="px-4 py-3 font-medium">{nameById[r.classroom_id] ?? "—"}</td>
                <td className="px-4 py-3">{r.attendance_date}</td>
                <td className="px-4 py-3 text-right">{r.on_time_count}</td>
                <td className="px-4 py-3 text-right">{r.late_count}</td>
                <td className="px-4 py-3 text-right">{r.on_time_count + r.late_count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function fmt(ts: string) {
  const d = new Date(ts);
  return d.toLocaleString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}
