import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  BarChart3,
  Building2,
  CalendarClock,
  FolderKanban,
  LayoutDashboard,
  ListChecks,
  ShieldCheck,
  Menu,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { CompanySwitcher } from "@/components/layout/CompanySwitcher";
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
  { to: "/admin", label: "Admin", icon: ShieldCheck, superOnly: true },
];

const noCompanyNav = new Set(["/", "/company", "/admin"]);

export default function AppLayout() {
  const { user, profile, signOut } = useAuth();
  const suspendedUntilFixed = Boolean(profile?.suspended_at);
  const { current } = useOrg();
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

  if (suspendedUntilFixed) {
    return (
      <div className="grid min-h-screen place-items-center px-4">
        <div className="max-w-md space-y-3 text-center" role="alert">
          <h1 className="text-2xl font-semibold">Account suspended</h1>
          <p className="text-muted-foreground">
            Your account has been suspended{profile?.suspended_reason ? `: ${profile.suspended_reason}` : "."} Contact the system administrator if you think this is a mistake.
          </p>
          <Button variant="outline" onClick={onSignOut}>
            Sign out
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen md:grid md:grid-cols-[15rem_1fr]">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-60 flex-col border-r bg-sidebar px-3 py-4 text-sidebar-foreground transition-transform md:sticky md:top-0 md:h-screen md:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="mb-6 flex items-center justify-between px-2">
          <span className="flex items-center gap-2.5">
            <span aria-hidden className="grid size-8 place-items-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground">U</span>
            <span className="text-base font-semibold tracking-tight">UrusProgres</span>
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="text-sidebar-foreground hover:bg-muted md:hidden"
            onClick={() => setOpen(false)}
            aria-label="Close menu"
          >
            <X />
          </Button>
        </div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto">
          {nav
            .filter(({ to }) => current || noCompanyNav.has(to))
            .filter(({ superOnly }) => !superOnly || profile?.is_superadmin)
            .map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-sidebar-foreground transition-colors hover:bg-muted",
                    isActive &&
                      "bg-sidebar-accent font-medium text-sidebar-accent-foreground hover:bg-sidebar-accent",
                  )
                }
              >
                <Icon className="size-4" />
                {label}
              </NavLink>
            ))}
        </nav>
        <div className="border-t border-sidebar-border pt-4">
          <CompanySwitcher onPicked={() => setOpen(false)} />
        </div>
      </aside>
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b bg-card/90 px-4 backdrop-blur md:px-8">
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
              <DropdownMenuTrigger render={<Button variant="ghost" className="gap-2" />}>
                <Avatar name={name} size="sm" />
                <span className="max-w-40 truncate">{name}</span>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => navigate("/profile")}>
                  Profile and password
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onSignOut}>
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        {current?.org.suspended_at && (
          <div role="status" className="border-b bg-warning-soft px-4 py-2 text-sm text-warning-foreground md:px-8">
            {current.org.name} is suspended and read-only{current.org.suspended_reason ? `: ${current.org.suspended_reason}` : "."}
          </div>
        )}
        <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 pb-24 md:px-8 md:py-8 md:pb-24">
          <Outlet />
        </main>
        <FloatingClock />
      </div>
    </div>
  );
}
