import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Clock3, ExternalLink, Grid2X2, ImageOff, LayoutList,
  Loader2, MoreHorizontal, Search, Trash2, CheckCircle2, XCircle, LoaderCircle,
} from "lucide-react";

import { Disclaimer } from "@/components/Disclaimer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { getDeviceId } from "@/lib/device";
import { deleteProject, listProjects } from "@/lib/generate.functions";

export const Route = createFileRoute("/projects")({
  head: () => ({ meta: [{ title: "Мои проекты — Image to Interactive Page" }, { name: "description", content: "Все сохранённые прототипы." }] }),
  component: Projects,
});

type Filter = "all" | "completed" | "processing" | "failed";
type Project = { id: string; title: string; status: string; source_image_url: string | null; preview_url: string | null; created_at: string };
const FAVORITES_KEY = "imtopage-project-favorites";

function Projects() {
  const [deviceId, setDeviceId] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<"newest" | "oldest">("newest");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [favorites, setFavorites] = useState<string[]>([]);
  useEffect(() => { setDeviceId(getDeviceId()); try { setFavorites(JSON.parse(localStorage.getItem(FAVORITES_KEY) ?? "[]")); } catch {} }, []);
  const listFn = useServerFn(listProjects); const deleteFn = useServerFn(deleteProject);
  const query = useQuery({ queryKey: ["projects", deviceId], enabled: Boolean(deviceId), queryFn: () => listFn({ data: { deviceId } }) });
  const remove = useMutation({ mutationFn: (id: string) => deleteFn({ data: { id, deviceId } }), onSuccess: () => { void query.refetch(); toast.success("Проект удалён"); }, onError: (e: Error) => toast.error(e.message) });
  const toggleFavorite = (id: string) => { const next = favorites.includes(id) ? favorites.filter((x) => x !== id) : [...favorites, id]; setFavorites(next); localStorage.setItem(FAVORITES_KEY, JSON.stringify(next)); };
  const projects = useMemo(() => {
    const rows = (query.data?.projects ?? []) as Project[];
    const q = search.trim().toLowerCase();
    return rows.filter((p) => (!q || p.title.toLowerCase().includes(q)) && (filter === "all" || p.status === filter)).sort((a,b) => sort === "newest" ? +new Date(b.created_at) - +new Date(a.created_at) : +new Date(a.created_at) - +new Date(b.created_at));
  }, [query.data?.projects, search, filter, sort]);

  const status = (value: string) => value === "completed" ? <span className="status-pill success"><CheckCircle2 className="size-3" /> Готово</span> : value === "failed" ? <span className="status-pill danger"><XCircle className="size-3" /> Ошибка</span> : <span className="status-pill"><LoaderCircle className="size-3 animate-spin" /> В работе</span>;

  return <main className="mx-auto max-w-7xl px-4 pb-24 pt-10">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div><div className="flex items-center gap-2"><h1 className="text-3xl font-bold">Мои проекты</h1><span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">{query.data?.projects.length ?? 0}</span></div><p className="mt-2 text-sm text-muted-foreground">Храните прототипы, возвращайтесь к ним и скачивайте готовые версии.</p></div>
      <Link to="/"><Button><span className="text-lg">+</span> Новый прототип</Button></Link>
    </div>

    <div className="panel mt-7 flex flex-wrap items-center gap-3 p-3">
      <div className="relative min-w-[240px] flex-1"><Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" /><Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Поиск по проектам" className="pl-9" /></div>
      <div className="flex flex-wrap gap-1 rounded-lg border border-border p-1">{([['all','Все'],['completed','Готово'],['processing','В работе'],['failed','Ошибки']] as [Filter,string][]).map(([id,label]) => <button key={id} onClick={() => setFilter(id)} className={`rounded-md px-3 py-1.5 text-xs ${filter === id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}>{label}</button>)}</div>
      <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} className="h-9 rounded-md border border-border bg-background px-3 text-xs"><option value="newest">Сначала новые</option><option value="oldest">Сначала старые</option></select>
      <div className="flex rounded-lg border border-border p-1"><button className={`rounded p-1.5 ${view === 'grid' ? 'bg-secondary' : ''}`} onClick={() => setView('grid')}><Grid2X2 className="size-4" /></button><button className={`rounded p-1.5 ${view === 'list' ? 'bg-secondary' : ''}`} onClick={() => setView('list')}><LayoutList className="size-4" /></button></div>
    </div>

    {query.isLoading ? <div className="mt-16 flex justify-center"><Loader2 className="size-6 animate-spin text-primary" /></div> : !projects.length ? <div className="panel mt-8 flex flex-col items-center gap-3 p-16 text-center"><ImageOff className="size-7 text-muted-foreground" /><p className="text-sm text-muted-foreground">{search || filter !== 'all' ? 'Ничего не найдено по заданным фильтрам.' : 'Пока ничего не сгенерировано.'}</p>{search || filter !== 'all' ? <Button variant="ghost" onClick={() => { setSearch(''); setFilter('all'); }}>Сбросить фильтры</Button> : <Link to="/" className="text-sm text-primary hover:underline">Загрузить первый скриншот</Link>}</div> :
      <div className={view === 'grid' ? 'mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3' : 'mt-6 space-y-3'}>{projects.map((project) => <div key={project.id} className={`panel group relative overflow-hidden transition-all hover:border-primary/40 ${view === 'list' ? 'flex items-center' : ''}`}>
        <Link to="/p/$projectId" params={{ projectId: project.id }} className={view === 'list' ? 'flex min-w-0 flex-1 items-center gap-4 p-3' : 'block'}>
          <div className={view === 'list' ? 'h-20 w-32 shrink-0 overflow-hidden rounded-lg bg-background/60' : 'aspect-video overflow-hidden bg-background/60'}>{project.preview_url ? <img src={project.preview_url} alt={project.title} className="size-full object-cover object-top transition-transform duration-500 group-hover:scale-105" /> : null}</div>
          <div className={view === 'list' ? 'min-w-0 flex-1 p-1' : 'p-4 pr-12'}><div className="flex items-center gap-2"><p className="truncate text-sm font-medium">{project.title}</p>{favorites.includes(project.id) && <span className="text-primary">★</span>}</div><div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground"><Clock3 className="size-3" />{new Date(project.created_at).toLocaleString('ru-RU')} {status(project.status)}</div></div>
        </Link>
        <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className={view === 'list' ? 'mr-2' : 'absolute right-2 top-2 size-8 bg-background/80 backdrop-blur'}><MoreHorizontal className="size-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onClick={() => toggleFavorite(project.id)}>{favorites.includes(project.id) ? 'Убрать из избранного' : 'Добавить в избранное'}</DropdownMenuItem><DropdownMenuItem asChild><Link to="/p/$projectId" params={{ projectId: project.id }}><ExternalLink className="size-4" /> Открыть проект</Link></DropdownMenuItem><DropdownMenuSeparator /><AlertDialog><AlertDialogTrigger asChild><DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive"><Trash2 className="size-4" /> Удалить</DropdownMenuItem></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Удалить проект?</AlertDialogTitle><AlertDialogDescription>«{project.title}» и исходный скриншот будут удалены без возможности восстановления.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Отмена</AlertDialogCancel><AlertDialogAction onClick={() => remove.mutate(project.id)} className="bg-destructive text-destructive-foreground"><Trash2 className="size-4" /> Удалить</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog></DropdownMenuContent></DropdownMenu>
      </div>)}</div>}
    <Disclaimer className="mt-10" />
  </main>;
}
