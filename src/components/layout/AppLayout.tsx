import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  BarChart3,
  Building2,
  CalendarClock,
  Layers,
  FolderKanban,
  LayoutDashboard,
  ListChecks,
  Menu,
  User,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { NotificationBell } from "@/components/NotificationBell";
import { Avatar } from "@/components/Avatar";
import { FloatingClock } from "@/components/attendance/FloatingClock";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/useAuth";
import { useOrg } from "@/hooks/useOrg";
import { cn } from "@/lib/utils";
import { errorMessage } from "@/lib/errors";

const nav = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/projects", label: "Projects", icon: FolderKanban },
  { to: "/my-tasks", label: "My Tasks", icon: ListChecks },
  { to: "/attendance", label: "Attendance", icon: CalendarClock },
  { to: "/reports", label: "Reports", icon: BarChart3 },
  { to: "/company", label: "Company", icon: Building2 },
  { to: "/profile", label: "Profile", icon: User },
];

const noCompanyNav = new Set(["/", "/company", "/profile"]);

export default function AppLayout() {
  const { user, profile, signOut } = useAuth();
  const { orgs, current, setCurrentId } = useOrg();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const name = profile?.full_name || user?.email || "Account";

  async function onSignOut() {
    try {
      await signOut();
      navigate("/login", { replace: true });
    } catch (err) {
      toast.error(errorMessage(err, "Sign out failed"));
    }
  }

  return (
    <div className="min-h-screen md:grid md:grid-cols-[14rem_1fr]">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-56 border-r bg-sidebar p-4 transition-transform md:static md:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="mb-6 flex items-center justify-between px-2 text-lg font-semibold">
          <span className="flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground">
              <Layers className="size-4" />
            </span>
            UrusProgres
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setOpen(false)}
            aria-label="Close menu"
          >
            <X />
          </Button>
        </div>
        {current && (
        <div className="mb-4">
          <label htmlFor="org-switch" className="mb-1 block px-1 text-xs font-medium text-muted-foreground">
            Company
          </label>
          <select
            id="org-switch"
            className="h-9 w-full rounded-lg border border-input bg-card px-2 text-sm"
            value={current?.org.id ?? ""}
            onChange={(e) => {
              setCurrentId(Number(e.target.value));
              navigate("/");
            }}
          >
            {orgs.map(({ org }) => (
              <option key={org.id} value={org.id}>
                {org.name}
              </option>
            ))}
          </select>
        </div>
        )}
        <nav className="space-y-1">
          {nav
            .filter(({ to }) => current || noCompanyNav.has(to))
            .map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent",
                  isActive && "bg-primary/10 font-medium text-primary hover:bg-primary/10",
                )
              }
            >
              <Icon className="size-4" />
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      <div className="flex min-w-0 flex-col">
        <header className="flex h-14 items-center justify-between border-b bg-card/80 px-4 backdrop-blur">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setOpen(true)}
            aria-label="Open menu"
          >
            <Menu />
          </Button>
          <div className="ml-auto flex items-center gap-1">
            <NotificationBell />
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button variant="outline" className="gap-2" />}>
                <Avatar name={name} size="sm" />
                <span className="max-w-40 truncate">{name}</span>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => navigate("/profile")}>
                  Profile
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onSignOut}>
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        <main className="flex-1 p-4 pb-24 md:p-6 md:pb-24">
          <Outlet />
        </main>
        <FloatingClock />
      </div>
    </div>
  );
}
