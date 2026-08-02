import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export function SiteHeader() {
  const [email, setEmail] = useState<string | null>(null);
  const path = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setEmail(data.session?.user.email ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setEmail(session?.user.email ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return (
    <header className="sticky top-0 z-50 border-b border-border/70 bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2">
          <span className="grid size-8 place-items-center rounded-lg bg-primary font-display text-sm font-bold text-primary-foreground">
            IP
          </span>
          <span className="font-display text-base font-semibold">Image → Interactive</span>
        </Link>

        <nav className="flex items-center gap-1 text-sm">
          <Link
            to="/"
            className={`rounded-md px-3 py-2 transition-colors hover:bg-secondary ${path === "/" ? "text-foreground" : "text-muted-foreground"}`}
          >
            Генератор
          </Link>
          <Link
            to="/projects"
            className={`rounded-md px-3 py-2 transition-colors hover:bg-secondary ${path === "/projects" ? "text-foreground" : "text-muted-foreground"}`}
          >
            Мои проекты
          </Link>
          {email ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={async () => {
                await supabase.auth.signOut();
              }}
            >
              Выйти
            </Button>
          ) : (
            <Button asChild size="sm">
              <Link to="/auth">Войти</Link>
            </Button>
          )}
        </nav>
      </div>
    </header>
  );
}
