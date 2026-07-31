import { Link, useNavigate } from "@tanstack/react-router";
import { Leaf, LogOut, Menu } from "lucide-react";
import { useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/useAuth";
import { Button } from "@/components/ui/button";

const NAV = [
  { to: "/", label: "Home" },
  { to: "/log", label: "Log waste" },
  { to: "/reports", label: "Reports" },
  { to: "/donate", label: "Donate" },
  { to: "/pickups", label: "Pickups" },
  { to: "/tips", label: "Tips" },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-30 border-b border-border/70 bg-background/85 backdrop-blur">
        <div className="mx-auto grid w-full max-w-6xl grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-4 py-3">
          <Link to="/" className="flex min-w-0 items-center gap-2">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground">
              <Leaf className="h-5 w-5" />
            </span>
            <span className="truncate text-lg font-bold tracking-tight">FoodSave</span>
          </Link>

          <div className="flex items-center gap-2">
            <nav className="hidden items-center gap-1 md:flex">
              {NAV.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-secondary-foreground"
                  activeProps={{ className: "bg-secondary text-secondary-foreground" }}
                  activeOptions={{ exact: item.to === "/" }}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
            {user ? (
              <Button variant="outline" size="sm" onClick={signOut} className="gap-2">
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Sign out</span>
              </Button>
            ) : (
              <Button asChild size="sm">
                <Link to="/auth">Sign in</Link>
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              aria-label="Toggle navigation"
              onClick={() => setOpen((v) => !v)}
            >
              <Menu className="h-5 w-5" />
            </Button>
          </div>
        </div>
        {open ? (
          <nav className="grid gap-1 border-t border-border/70 px-4 py-3 md:hidden">
            {NAV.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-secondary"
                activeProps={{ className: "bg-secondary text-secondary-foreground" }}
                activeOptions={{ exact: item.to === "/" }}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        ) : null}
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-border/70 bg-secondary/40">
        <div className="mx-auto w-full max-w-6xl px-4 py-8 text-sm text-muted-foreground">
          FoodSave — track what you throw away, share what you can spare.
        </div>
      </footer>
    </div>
  );
}
