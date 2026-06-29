import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, LogIn } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Admin Sign In — Morning Attendance" }] }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/admin" });
    });
  }, [navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Signed in.");
    navigate({ to: "/admin" });
  }

  return (
    <main className="mx-auto flex max-w-md flex-col px-4 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">Admin sign in</h1>
      <p className="mt-1 text-sm text-muted-foreground">Only school admins can manage classrooms.</p>

      <form onSubmit={handleSubmit} className="mt-6 rounded-2xl border bg-card p-5 shadow-sm sm:p-6">
        <label className="mb-4 block">
          <span className="mb-1.5 block text-sm font-medium">Email</span>
          <input
            type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
            className="h-12 w-full rounded-xl border bg-background px-3 outline-none focus:ring-2 focus:ring-primary"
          />
        </label>
        <label className="mb-4 block">
          <span className="mb-1.5 block text-sm font-medium">Password</span>
          <input
            type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
            className="h-12 w-full rounded-xl border bg-background px-3 outline-none focus:ring-2 focus:ring-primary"
          />
        </label>
        <button
          type="submit" disabled={busy}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
          Sign in
        </button>
      </form>
    </main>
  );
}
