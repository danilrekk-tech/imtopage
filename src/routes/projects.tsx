import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ImageOff, Loader2 } from "lucide-react";

import { Disclaimer } from "@/components/Disclaimer";
import { getDeviceId } from "@/lib/device";
import { listProjects } from "@/lib/generate.functions";

export const Route = createFileRoute("/projects")({
  head: () => ({
    meta: [
      { title: "Мои проекты — Image to Interactive Page" },
      {
        name: "description",
        content: "Все сгенерированные интерактивные страницы с превью исходных скриншотов и датой.",
      },
      { property: "og:title", content: "Мои проекты — Image to Interactive Page" },
      {
        property: "og:description",
        content: "История сгенерированных интерактивных страниц.",
      },
    ],
  }),
  component: Projects,
});

function Projects() {
  const [deviceId, setDeviceId] = useState("");
  useEffect(() => setDeviceId(getDeviceId()), []);
  const listFn = useServerFn(listProjects);

  const query = useQuery({
    queryKey: ["projects", deviceId],
    enabled: Boolean(deviceId),
    queryFn: () => listFn({ data: { deviceId } }),
  });

  return (
    <main className="mx-auto max-w-7xl px-4 pb-24 pt-12">
      <h1 className="text-3xl font-bold">Мои проекты</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {query.data?.quota.signedIn
          ? `Использовано сегодня: ${query.data.quota.used} из ${query.data.quota.limit}`
          : `Гостевой режим: ${query.data?.quota.used ?? 0} из ${query.data?.quota.limit ?? 3} генераций`}
      </p>

      {query.isLoading ? (
        <div className="mt-16 flex justify-center">
          <Loader2 className="size-6 animate-spin text-primary" />
        </div>
      ) : !query.data?.projects.length ? (
        <div className="panel mt-8 flex flex-col items-center gap-3 p-16 text-center">
          <ImageOff className="size-7 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Пока ничего не сгенерировано.</p>
          <Link to="/" className="text-sm text-primary hover:underline">
            Загрузить первый скриншот
          </Link>
        </div>
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {query.data.projects.map((project) => (
            <Link
              key={project.id}
              to="/p/$projectId"
              params={{ projectId: project.id }}
              className="panel group overflow-hidden transition-transform hover:-translate-y-1"
            >
              <div className="aspect-video overflow-hidden bg-background/50">
                {project.preview_url ? (
                  <img
                    src={project.preview_url}
                    alt={project.title}
                    className="size-full object-cover object-top transition-transform duration-500 group-hover:scale-105"
                  />
                ) : null}
              </div>
              <div className="p-4">
                <p className="truncate text-sm font-medium">{project.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {new Date(project.created_at).toLocaleString("ru-RU")} ·{" "}
                  {project.status === "completed"
                    ? "готово"
                    : project.status === "failed"
                      ? "ошибка"
                      : "в работе"}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}

      <Disclaimer className="mt-10" />
    </main>
  );
}
