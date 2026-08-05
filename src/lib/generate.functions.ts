import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const GenerateInput = z.object({
  imageBase64: z.string().min(50),
  fileName: z.string().default("screenshot.png"),
  deviceId: z.string().min(1),
});

const EditInput = z.object({
  projectId: z.string().uuid(),
  instruction: z.string().min(2).max(2000),
  deviceId: z.string().min(1),
});

export const generatePage = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => GenerateInput.parse(input))
  .handler(async ({ data }) => {
    const {
      admin,
      optionalUserId,
      trackUsage,
      callModel,
      log,
      sha256Hex,
      getCached,
      saveCache,
      assertRateLimit,
      requestSubject,
    } = await import("./generate.server");
    const db = admin();
    const userId = await optionalUserId();
    await assertRateLimit(requestSubject(userId, data.deviceId));
    await trackUsage(userId);

    const match = /^data:(image\/[a-zA-Z+]+);base64,(.+)$/.exec(data.imageBase64);
    if (!match) throw new Error("Неверный формат изображения. Загрузите PNG или JPG.");
    const mime = match[1]!;
    const bytes = Uint8Array.from(atob(match[2]!), (c) => c.charCodeAt(0));
    if (bytes.byteLength > 10 * 1024 * 1024) throw new Error("Файл больше 10 МБ.");

    const imageHash = await sha256Hex(bytes);

    const ext = mime.split("/")[1] === "jpeg" ? "jpg" : (mime.split("/")[1] ?? "png");
    const path = `${userId ?? `guest/${data.deviceId}`}/${crypto.randomUUID()}.${ext}`;
    await db.storage.from("screenshots").upload(path, bytes, { contentType: mime });

    const { data: project, error: insertError } = await db
      .from("projects")
      .insert({
        user_id: userId,
        device_id: data.deviceId,
        source_image_url: path,
        title: data.fileName.replace(/\.[^.]+$/, "").slice(0, 80) || "Без названия",
        status: "processing",
      })
      .select("id")
      .single();
    if (insertError || !project) throw new Error("Не удалось создать проект.");

    await log(project.id, "upload", "completed");

    // Кеш по SHA-256 хешу изображения — без вызова AI.
    const cached = await getCached(imageHash);
    if (cached) {
      await db
        .from("projects")
        .update({
          generated_html: cached.result,
          component_map: { analysis: cached.analysis ?? "", provider: "cache" },
          status: "completed",
        })
        .eq("id", project.id);
      await log(project.id, "generate", "completed", `cache (${cached.provider})`);
      console.info("[ai-provider] cache hit", imageHash.slice(0, 12));
      return {
        projectId: project.id,
        html: cached.result,
        analysis: cached.analysis ?? "",
        provider: "cache" as const,
      };
    }

    try {
      await log(project.id, "analyze", "started");
      const { html, analysis, provider } = await callModel([
        {
          type: "text",
          text: "Воссоздай эту страницу как интерактивный HTML-документ по правилам из системного промта.",
        },
        { type: "image_url", image_url: { url: data.imageBase64 } },
      ]);
      await db
        .from("projects")
        .update({
          generated_html: html,
          component_map: { analysis, provider },
          status: "completed",
        })
        .eq("id", project.id);
      await saveCache(imageHash, html, analysis, provider);
      await log(project.id, "generate", "completed", provider);
      return { projectId: project.id, html, analysis, provider };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Неизвестная ошибка";
      await db.from("projects").update({ status: "failed" }).eq("id", project.id);
      await log(project.id, "generate", "failed", message);
      throw new Error(message);
    }
  });


export const editPage = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => EditInput.parse(input))
  .handler(async ({ data }) => {
    const { admin, optionalUserId, callModel, log } = await import("./generate.server");
    const db = admin();
    const userId = await optionalUserId();

    const { data: project } = await db
      .from("projects")
      .select("id, user_id, device_id, generated_html")
      .eq("id", data.projectId)
      .maybeSingle();
    if (!project) throw new Error("Проект не найден.");
    const owns = userId ? project.user_id === userId : project.device_id === data.deviceId;
    if (!owns) throw new Error("Нет доступа к этому проекту.");
    if (!project.generated_html) throw new Error("У проекта ещё нет сгенерированного кода.");

    await log(project.id, "edit", "started");
    try {
      const { html, analysis, provider } = await callModel([
        {
          type: "text",
          text: `edit_instruction: ${data.instruction}\n\nprevious_html:\n${project.generated_html}`,
        },
      ]);
      await db
        .from("projects")
        .update({
          generated_html: html,
          component_map: { analysis, provider },
          status: "completed",
        })
        .eq("id", project.id);
      await log(project.id, "edit", "completed", provider);
      return { html, analysis, provider };

    } catch (error) {
      const message = error instanceof Error ? error.message : "Неизвестная ошибка";
      await log(project.id, "edit", "failed", message);
      throw new Error(message);
    }
  });

export const listProjects = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ deviceId: z.string().min(1) }).parse(input))
  .handler(async ({ data }) => {
    const { admin, optionalUserId, signedUrl } = await import("./generate.server");
    const db = admin();
    const userId = await optionalUserId();

    const query = db
      .from("projects")
      .select("id, title, status, source_image_url, created_at")
      .order("created_at", { ascending: false })
      .limit(100);

    const { data: rows } = userId
      ? await query.eq("user_id", userId)
      : await query.is("user_id", null).eq("device_id", data.deviceId);

    const projects = await Promise.all(
      (rows ?? []).map(async (row) => ({
        ...row,
        preview_url: await signedUrl(row.source_image_url),
      })),
    );

    return { projects, signedIn: Boolean(userId) };
  });

export const getProject = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid(), deviceId: z.string().min(1) }).parse(input),
  )
  .handler(async ({ data }) => {
    const { admin, optionalUserId, signedUrl } = await import("./generate.server");
    const db = admin();
    const userId = await optionalUserId();
    const { data: project } = await db
      .from("projects")
      .select(
        "id, title, status, generated_html, component_map, source_image_url, user_id, device_id",
      )
      .eq("id", data.id)
      .maybeSingle();
    if (!project) throw new Error("Проект не найден.");
    const owns = userId ? project.user_id === userId : project.device_id === data.deviceId;
    if (!owns) throw new Error("Нет доступа к этому проекту.");
    return {
      id: project.id,
      title: project.title,
      status: project.status,
      html: project.generated_html,
      analysis: (project.component_map as { analysis?: string } | null)?.analysis ?? "",
      image_url: await signedUrl(project.source_image_url),
    };
  });
