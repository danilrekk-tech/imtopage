import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Lock } from "lucide-react";

import { getSharedPage } from "@/lib/share.functions";

export const Route = createFileRoute("/s/$token")({
  head: () => ({
    meta: [
      { title: "Превью страницы — Image to Interactive Page" },
      {
        name: "description",
        content: "Публичное превью интерактивного прототипа, созданного из скриншота.",
      },
      { property: "og:title", content: "Превью страницы — Image to Interactive Page" },
      {
        property: "og:description",
        content: "Готовый интерактивный прототип, доступный по защищённой ссылке.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SharedPage,
});

function SharedPage() {
  const { token } = Route.useParams();
  const fetchPage = useServerFn(getSharedPage);

  const query = useQuery({
    queryKey: ["shared", token],
    queryFn: () => fetchPage({ data: { token } }),
    retry: false,
  });

  if (query.isLoading) {
    return (
      <main className="flex min-h-[70vh] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-primary" />
      </main>
    );
  }

  if (query.error) {
    return (
      <main className="mx-auto max-w-xl px-4 py-24 text-center">
        <Lock className="mx-auto size-6 text-muted-foreground" />
        <h1 className="mt-4 text-2xl font-bold">Страница недоступна</h1>
        <p className="mt-2 text-sm text-muted-foreground">{(query.error as Error).message}</p>
      </main>
    );
  }

  // Normal GET requests to /s/:token are served directly by src/server.ts as the generated HTML.
  // This fallback is kept only for client-side navigation inside the app.
  return (
    <main className="min-h-screen bg-white">
      <iframe
        title="Опубликованная страница"
        srcDoc={query.data?.html ?? ""}
        sandbox="allow-scripts allow-forms allow-popups"
        className="h-screen w-full border-0"
      />
    </main>
  );
}
