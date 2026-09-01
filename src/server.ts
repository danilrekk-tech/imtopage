import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

async function serveSharedPrototype(request: Request): Promise<Response | null> {
  const url = new URL(request.url);
  const match = url.pathname.match(/^\/s\/([A-Za-z0-9_-]{8,64})\/?$/);
  if (!match || request.method !== "GET") return null;

  try {
    const { admin } = await import("./lib/generate.server");
    const db = admin();
    const { data: project } = await db
      .from("projects")
      .select("id, title, generated_html, share_visibility, share_token")
      .eq("share_token", match[1])
      .maybeSingle();

    if (!project || project.share_visibility === "private" || !project.generated_html) {
      return new Response("<h1>Страница недоступна</h1>", {
        status: 404,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }

    // A "link" share is intentionally served as the generated HTML itself.
    // The "users" mode stays on the app route so its authenticated serverFn
    // can validate the invited account before returning the preview.
    if (project.share_visibility !== "link") return null;

    let html = project.generated_html.trim();
    if (!/^<!doctype html/i.test(html)) {
      html = `<!doctype html><html lang="ru"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(project.title)}</title></head><body>${html}</body></html>`;
    }

    // The share URL is a standalone website, not an app page containing an iframe.
    return new Response(html, {
      status: 200,
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "private, no-store",
        "content-security-policy": "frame-ancestors 'self'",
        "x-content-type-options": "nosniff",
      },
    });
  } catch (error) {
    console.error("Shared prototype error", error);
    return new Response("<h1>Не удалось открыть прототип</h1>", {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>'\"]/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '\"': "&quot;",
  })[char] ?? char);
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const sharedResponse = await serveSharedPrototype(request);
      if (sharedResponse) return sharedResponse;

      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
