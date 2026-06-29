import { Link } from "@tanstack/react-router";
import { ClipboardList, BarChart3, Settings } from "lucide-react";

export function Header() {
  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link to="/" className="flex items-center gap-2 font-semibold text-foreground">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <ClipboardList className="h-4 w-4" />
          </div>
          <span className="hidden sm:inline">Morning Attendance</span>
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          <NavLink to="/" icon={<ClipboardList className="h-4 w-4" />} label="Submit" />
          <NavLink to="/dashboard" icon={<BarChart3 className="h-4 w-4" />} label="Dashboard" />
          <NavLink to="/admin" icon={<Settings className="h-4 w-4" />} label="Admin" />
        </nav>
      </div>
    </header>
  );
}

function NavLink({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) {
  return (
    <Link
      to={to}
      activeOptions={{ exact: to === "/" }}
      className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground [&.active]:bg-accent [&.active]:text-accent-foreground"
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </Link>
  );
}
