import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Вход — Image to Interactive Page" },
      {
        name: "description",
        content: "Войдите, чтобы сохранять проекты и получать 15 генераций страниц в день.",
      },
      { property: "og:title", content: "Вход — Image to Interactive Page" },
      {
        property: "og:description",
        content: "Аккаунт даёт историю проектов и повышенный дневной лимит генераций.",
      },
    ],
  }),
  component: Auth,
});

function Auth() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        toast.success("Проверьте почту и подтвердите адрес, чтобы войти.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/" });
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось войти");
    } finally {
      setLoading(false);
    }
  };

  const google = async () => {
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      toast.error("Не удалось войти через Google");
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/" });
  };

  return (
    <main className="mx-auto flex min-h-[80vh] max-w-md flex-col justify-center px-4 py-16">
      <div className="panel p-7">
        <h1 className="text-2xl font-bold">
          {mode === "signin" ? "Вход в аккаунт" : "Регистрация"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Аккаунт даёт 15 генераций в день и историю проектов.
        </p>

        <Button variant="secondary" className="mt-6 w-full" onClick={google}>
          Продолжить с Google
        </Button>

        <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
          <span className="h-px flex-1 bg-border" /> или <span className="h-px flex-1 bg-border" />
        </div>

        <form className="space-y-4" onSubmit={submit}>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Пароль</Label>
            <Input
              id="password"
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? <Loader2 className="size-4 animate-spin" /> : null}
            {mode === "signin" ? "Войти" : "Создать аккаунт"}
          </Button>
        </form>

        <button
          className="mt-5 w-full text-center text-xs text-muted-foreground transition-colors hover:text-foreground"
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
        >
          {mode === "signin" ? "Нет аккаунта? Зарегистрироваться" : "Уже есть аккаунт? Войти"}
        </button>
      </div>
    </main>
  );
}
