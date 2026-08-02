import { requireAdmin, safeError } from "@/server/music/auth";
import { ensureMusicSchema } from "@/server/music/database";

export async function GET(request: Request) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  try {
    const db = await ensureMusicSchema();
    const songs = await db.prepare("SELECT id, provider, provider_song_id, title, artist, album, genre, duration, license, license_url, artwork_url, clip_start_seconds, status, failure_reason, created_at, updated_at FROM music_songs ORDER BY created_at DESC LIMIT 250").all();
    return Response.json({ songs: songs.results ?? [] });
  } catch (error) {
    return Response.json({ error: safeError(error) }, { status: 500 });
  }
}

