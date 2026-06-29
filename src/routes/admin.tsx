import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Pencil, Plus, Trash2, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Admin — Morning Attendance" }] }),
  component: AdminPage,
});

type Classroom = {
  id: string; classroom_name: string; total_students: number; active: boolean;
};

function AdminPage() {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [rows, setRows] = useState<Classroom[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Classroom | null>(null);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { navigate({ to: "/auth" }); return; }
      const { data: roles } = await supabase
        .from("user_roles").select("role").eq("user_id", session.user.id);
      const admin = !!roles?.some((r) => r.role === "admin");
      setIsAdmin(admin);
      setChecking(false);
      if (admin) refresh();
    })();
  }, [navigate]);

  async function refresh() {
    setLoading(true);
    const { data, error } = await supabase
      .from("classrooms").select("*").order("classroom_name");
    if (error) toast.error(error.message);
    else setRows(data ?? []);
    setLoading(false);
  }

  async function toggleActive(c: Classroom) {
    const { error } = await supabase.from("classrooms")
      .update({ active: !c.active }).eq("id", c.id);
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
          Your account does not have admin access. Ask another admin to grant you the admin role.
        </p>
        <button onClick={signOut} className="mt-4 rounded-xl border px-4 py-2 text-sm hover:bg-accent">Sign out</button>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Admin</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage classrooms shown on the attendance form.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => { setEditing(null); setShowForm(true); }}
            className="flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" /> Add classroom
          </button>
          <button onClick={signOut} className="flex h-10 items-center gap-2 rounded-xl border px-4 text-sm hover:bg-accent">
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
      </header>

      <section className="overflow-hidden rounded-2xl border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Classroom</th>
                <th className="px-4 py-3 text-right">Total students</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">Loading…</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">No classrooms.</td></tr>
              ) : rows.map((c) => (
                <tr key={c.id} className="border-t">
                  <td className="px-4 py-3 font-medium">{c.classroom_name}</td>
                  <td className="px-4 py-3 text-right">{c.total_students}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => toggleActive(c)}
                      className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${
                        c.active ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                      }`}
                    >
                      <span className={`h-2 w-2 rounded-full ${c.active ? "bg-primary" : "bg-muted-foreground"}`} />
                      {c.active ? "Active" : "Disabled"}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex gap-1">
                      <button
                        onClick={() => { setEditing(c); setShowForm(true); }}
                        className="rounded-lg p-2 hover:bg-accent" title="Edit"
                      ><Pencil className="h-4 w-4" /></button>
                      <button
                        onClick={() => remove(c)}
                        className="rounded-lg p-2 text-destructive hover:bg-destructive/10" title="Delete"
                      ><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {showForm && (
        <ClassroomDialog
          initial={editing}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); refresh(); }}
        />
      )}
    </main>
  );
}

function ClassroomDialog({
  initial, onClose, onSaved,
}: { initial: Classroom | null; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(initial?.classroom_name ?? "");
  const [total, setTotal] = useState(initial?.total_students.toString() ?? "");
  const [active, setActive] = useState(initial?.active ?? true);
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const n = Number(total);
    if (!name.trim()) return toast.error("Name is required.");
    if (!Number.isInteger(n) || n < 0) return toast.error("Total students must be a non-negative whole number.");
    setBusy(true);
    const payload = { classroom_name: name.trim(), total_students: n, active };
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
        <label className="mb-3 block">
          <span className="mb-1.5 block text-sm font-medium">Total students</span>
          <input type="number" min={0} step={1} value={total} onChange={(e) => setTotal(e.target.value)} required
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
