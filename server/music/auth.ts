import { env } from "cloudflare:workers";

export function requireAdmin(request: Request): Response | null {
  const allowed = env.ADMIN_EMAILS?.split(",").map((email) => email.trim().toLowerCase()).filter(Boolean) ?? [];
  const current = request.headers.get("oai-authenticated-user-email")?.toLowerCase();
  const hostname = new URL(request.url).hostname;
  const local = hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1" || hostname === "[::1]";
  if (local && allowed.length === 0) return null;
  if (!current || !allowed.includes(current)) return Response.json({ error: "Admin access is required." }, { status: 403 });
  return null;
}

export function safeError(error: unknown): string {
  return error instanceof Error ? error.message : "Unexpected music import error.";
}
