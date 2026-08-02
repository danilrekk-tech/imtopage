import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Disclaimer } from "@/components/Disclaimer";
import { getDeviceId } from "@/lib/device";
import { editPage, getProject } from "@/lib/generate.functions";

export const Route = createFileRoute("/p/$projectId")({
  head: () => ({
    meta: [
      { title: "Проект — Image to Interactive Page" },
      {
        name: "description",
        content: "Живое превью сгенерированной интерактивной страницы рядом с оригиналом.",
      },
      { property: "og:title", content: "Проект — Image to Interactive Page" },
      {
        property: "og:description",
        content: "Сравните оригинальный макет и сгенерированную интерактивную страницу.",
      },
    ],
  }),
  component: ProjectView,
});

type ViewMode = "original" | "result" | "split";

function ProjectView() {
  const { projectId } = Route.useParams();
  const [deviceId, setDeviceId] = useState("");
  const [view, setView] = useState<ViewMode>("split");
  const [instruction, setInstruction] = useState("");
  const [html, setHtml] = useState<string | null>(null);

  useEffect(() => setDeviceId(getDeviceId()), []);

  const getFn = useServerFn(getProject);
  const editFn = useServerFn(editPage);

  const query = useQuery({
    queryKey: ["project", projectId, deviceId],
    enabled: Boolean(deviceId),
    queryFn: () => getFn({ data: { id: projectId, deviceId } }),
  });

  useEffect(() => {
    if (query.data?.html) setHtml(query.data.html);
  }, [query.data?.html]);

  const edit = useMutation({
    mutationFn: (text: string) => editFn({ data: { projectId, instruction: text, deviceId } }),
    onSuccess: (data) => {
      setHtml(data.html);
      setInstruction("");
      toast.success("Правка внесена");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const download = () => {
    if (!html) return;
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${query.data?.title ?? "page"}.html`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (query.isLoading) {
    return (
      <main className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-primary" />
      </main>
    );
  }

  if (query.error) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-24 text-center">
        <h1 className="text-2xl font-bold">Проект недоступен</h1>
        <p className="mt-2 text-sm text-muted-foreground">{(query.error as Error).message}</p>
        <Link to="/projects" className="mt-6 inline-block text-sm text-primary hover:underline">
          К моим проектам
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-7xl px-4 pb-24 pt-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{query.data?.title}</h1>
          <Link to="/projects" className="text-xs text-muted-foreground hover:text-foreground">
            ← Мои проекты
          </Link>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-border p-0.5 text-xs">
            {(
              [
                ["original", "Оригинал"],
                ["result", "Результат"],
                ["split", "Рядом"],
              ] as [ViewMode, string][]
            ).map(([mode, label]) => (
              <button
                key={mode}
                onClick={() => setView(mode)}
                className={`rounded-md px-3 py-1.5 transition-colors ${
                  view === mode
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <Button variant="secondary" size="sm" onClick={download} disabled={!html}>
            <Download className="size-4" /> Скачать код
          </Button>
        </div>
      </div>

      <div className={`mt-6 grid gap-4 ${view === "split" ? "lg:grid-cols-2" : "grid-cols-1"}`}>
        {view !== "result" && query.data?.image_url ? (
          <div className="panel overflow-auto p-2">
            <img src={query.data.image_url} alt="Оригинальный макет" className="w-full rounded-lg" />
          </div>
        ) : null}
        {view !== "original" ? (
          <iframe
            title="Сгенерированная страница"
            srcDoc={html ?? ""}
            sandbox="allow-scripts allow-forms allow-popups"
            className="h-[700px] w-full rounded-2xl border border-border bg-white"
          />
        ) : null}
      </div>

      <div className="panel mt-6 p-5">
        <p className="text-sm font-medium">Редактировать текстом</p>
        <form
          className="mt-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (instruction.trim().length > 1) edit.mutate(instruction.trim());
          }}
        >
          <Input
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            placeholder="Например: аккордеон FAQ должен открываться плавнее"
            disabled={edit.isPending}
          />
          <Button type="submit" disabled={edit.isPending || instruction.trim().length < 2}>
            {edit.isPending ? <Loader2 className="size-4 animate-spin" /> : "Применить"}
          </Button>
        </form>
        <Disclaimer className="mt-4" />
      </div>
    </main>
  );
}
