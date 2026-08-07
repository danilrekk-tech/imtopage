import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Check, Copy, Link2, Loader2, Share2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  getShareSettings,
  updateShareSettings,
  type ShareVisibility,
} from "@/lib/share.functions";

const MODES: [ShareVisibility, string, string][] = [
  ["private", "Только я", "Ссылка не работает, страницу видит только владелец."],
  ["link", "Все по ссылке", "Кто угодно со ссылкой откроет превью без входа."],
  ["users", "Конкретные люди", "Нужен вход под приглашённым e-mail."],
];

export function ShareDialog({ projectId, deviceId }: { projectId: string; deviceId: string }) {
  const [open, setOpen] = useState(false);
  const [visibility, setVisibility] = useState<ShareVisibility>("private");
  const [emails, setEmails] = useState("");
  const [copied, setCopied] = useState(false);

  const getFn = useServerFn(getShareSettings);
  const updateFn = useServerFn(updateShareSettings);

  const query = useQuery({
    queryKey: ["share", projectId],
    enabled: open && Boolean(deviceId),
    queryFn: () => getFn({ data: { projectId, deviceId } }),
  });

  useEffect(() => {
    if (!query.data) return;
    setVisibility(query.data.visibility);
    setEmails(query.data.emails.join(", "));
  }, [query.data]);

  const save = useMutation({
    mutationFn: () =>
      updateFn({
        data: {
          projectId,
          deviceId,
          visibility,
          emails: emails
            .split(/[,\s]+/)
            .map((e) => e.trim())
            .filter((e) => e.includes("@")),
        },
      }),
    onSuccess: () => {
      void query.refetch();
      toast.success("Настройки доступа сохранены");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const token = save.data?.token ?? query.data?.token ?? null;
  const url =
    token && visibility !== "private" && typeof window !== "undefined"
      ? `${window.location.origin}/s/${token}`
      : "";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary" size="sm">
          <Share2 className="size-4" /> Поделиться
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Публичная ссылка на превью</DialogTitle>
          <DialogDescription>
            Выберите, кто сможет открыть готовую страницу.
          </DialogDescription>
        </DialogHeader>

        {query.isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="size-5 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              {MODES.map(([mode, label, hint]) => (
                <button
                  key={mode}
                  onClick={() => setVisibility(mode)}
                  className={`flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors ${
                    visibility === mode
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <Check
                    className={`mt-0.5 size-4 ${visibility === mode ? "text-primary" : "opacity-0"}`}
                  />
                  <span>
                    <span className="block text-sm font-medium">{label}</span>
                    <span className="block text-xs text-muted-foreground">{hint}</span>
                  </span>
                </button>
              ))}
            </div>

            {visibility === "users" ? (
              <div>
                <label className="text-xs text-muted-foreground" htmlFor={`emails-${projectId}`}>
                  E-mail через запятую
                </label>
                <Input
                  id={`emails-${projectId}`}
                  value={emails}
                  onChange={(e) => setEmails(e.target.value)}
                  placeholder="designer@team.ru, pm@team.ru"
                  className="mt-1"
                />
              </div>
            ) : null}

            <Button className="w-full" onClick={() => save.mutate()} disabled={save.isPending}>
              {save.isPending ? <Loader2 className="size-4 animate-spin" /> : null} Сохранить доступ
            </Button>

            {url ? (
              <div className="flex items-center gap-2 rounded-lg border border-border p-2">
                <Link2 className="size-4 shrink-0 text-primary" />
                <span className="truncate font-mono text-xs">{url}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label="Скопировать ссылку"
                  onClick={() => {
                    void navigator.clipboard.writeText(url).then(() => {
                      setCopied(true);
                      toast.success("Ссылка скопирована");
                      setTimeout(() => setCopied(false), 1500);
                    });
                  }}
                >
                  {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                </Button>
              </div>
            ) : null}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
