import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const VisibilitySchema = z.enum(["private", "link", "users"]);

const UpdateInput = z.object({
  projectId: z.string().uuid(),
  deviceId: z.string().min(1),
  visibility: VisibilitySchema,
  emails: z.array(z.string().email()).max(50).default([]),
});

export type ShareVisibility = z.infer<typeof VisibilitySchema>;

/** Настройки публичной ссылки проекта (только для владельца). */
export const getShareSettings = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ projectId: z.string().uuid(), deviceId: z.string().min(1) }).parse(input),
  )
  .handler(async ({ data }) => {
    const { admin, optionalUserId } = await import("./generate.server");
    const db = admin();
    const userId = await optionalUserId();

    const { data: project } = await db
      .from("projects")
      .select("id, user_id, device_id, share_token, share_visibility")
      .eq("id", data.projectId)
      .maybeSingle();
    if (!project) throw new Error("Проект не найден.");
    const owns = userId ? project.user_id === userId : project.device_id === data.deviceId;
    if (!owns) throw new Error("Нет доступа к этому проекту.");

    const { data: shares } = await db
      .from("project_shares")
      .select("email")
      .eq("project_id", project.id);

    return {
      visibility: (project.share_visibility ?? "private") as ShareVisibility,
      token: project.share_token as string | null,
      emails: (shares ?? []).map((row) => row.email),
    };
  });

/** Меняет режим доступа и список приглашённых, выдаёт ссылку. */
export const updateShareSettings = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => UpdateInput.parse(input))
  .handler(async ({ data }) => {
    const { admin, optionalUserId } = await import("./generate.server");
    const db = admin();
    const userId = await optionalUserId();

    const { data: project } = await db
      .from("projects")
      .select("id, user_id, device_id, share_token")
      .eq("id", data.projectId)
      .maybeSingle();
    if (!project) throw new Error("Проект не найден.");
    const owns = userId ? project.user_id === userId : project.device_id === data.deviceId;
    if (!owns) throw new Error("Нет доступа к этому проекту.");

    const token =
      data.visibility === "private"
        ? (project.share_token ?? null)
        : (project.share_token ?? crypto.randomUUID().replace(/-/g, ""));

    await db
      .from("projects")
      .update({ share_visibility: data.visibility, share_token: token })
      .eq("id", project.id);

    await db.from("project_shares").delete().eq("project_id", project.id);
    const emails = Array.from(new Set(data.emails.map((e) => e.trim().toLowerCase()))).filter(
      Boolean,
    );
    if (data.visibility === "users" && emails.length) {
      await db
        .from("project_shares")
        .insert(emails.map((email) => ({ project_id: project.id, email })));
    }

    return { visibility: data.visibility, token, emails };
  });

/** Публичная страница по токену. Проверяет режим доступа. */
export const getSharedPage = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ token: z.string().min(8).max(64) }).parse(input))
  .handler(async ({ data }) => {
    const { admin, optionalUser } = await import("./generate.server");
    const db = admin();

    const { data: project } = await db
      .from("projects")
      .select("id, title, generated_html, share_visibility, share_token")
      .eq("share_token", data.token)
      .maybeSingle();

    if (!project || project.share_visibility === "private" || !project.generated_html) {
      throw new Error("Ссылка недействительна или доступ закрыт.");
    }

    if (project.share_visibility === "users") {
      const viewer = await optionalUser();
      const email = viewer?.email?.toLowerCase();
      if (!email) throw new Error("Войдите под приглашённым аккаунтом, чтобы открыть страницу.");
      const { data: allowed } = await db
        .from("project_shares")
        .select("email")
        .eq("project_id", project.id)
        .eq("email", email)
        .maybeSingle();
      if (!allowed) throw new Error("У вашего аккаунта нет доступа к этой странице.");
    }

    return { title: project.title, html: project.generated_html };
  });
