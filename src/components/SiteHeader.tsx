import { Link, useRouterState } from "@tanstack/react-router";
import { Moon, Download, Sparkles, Sun } from "lucide-react";
import { useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export function SiteHeader() {
  const [email, setEmail] = useState<string | null>(null);
  const [dark, setDark] = useState(true);
  const path = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setEmail(data.session?.user.email ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setEmail(session?.user.email ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  return (
    <header className="app-topbar">
      <div className="flex min-w-0 items-center gap-3">
        <Link to="/" className="brand-mark" aria-label="Image to Interactive">
          IP
        </Link>
        <div className="hidden min-w-0 sm:block">
          <div className="font-display text-sm font-semibold">Image → Interactive</div>
          <div className="text-[11px] text-muted-foreground">Прототипы, готовые к коду</div>
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        <button className="icon-button" aria-label="Переключить тему" onClick={() => setDark((v) => !v)}>
          {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
        </button>
        {email ? (
          <Button variant="ghost" size="sm" onClick={() => supabase.auth.signOut()}>
            Выйти
          </Button>
        ) : (
          <Button asChild size="sm" className="top-login">
            <Link to="/auth">Войти</Link>
          </Button>
        )}
      </div>
    </header>
  );
}
