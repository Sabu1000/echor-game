import { requireAdmin, safeError } from "@/server/music/auth";
import { queueProviderSong } from "@/server/music/importService";

export async function POST(request: Request) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  try {
    const payload = await request.json() as { provider?: string; providerSongId?: string; clipStartSeconds?: number };
    if (!payload.providerSongId || !payload.provider) return Response.json({ error: "provider and providerSongId are required." }, { status: 400 });
    const result = await queueProviderSong(payload.provider, payload.providerSongId, Number(payload.clipStartSeconds ?? 0));
    return Response.json(result, { status: result.duplicate ? 200 : 202 });
  } catch (error) {
    const message = safeError(error);
    return Response.json({ error: message }, { status: message.startsWith("License rejected") ? 422 : 500 });
  }
}

