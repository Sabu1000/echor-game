import { requireAdmin, safeError } from "@/server/music/auth";
import { ensureMusicSchema } from "@/server/music/database";

export async function GET(request: Request) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  try {
    const db = await ensureMusicSchema();
    const jobs = await db.prepare(`SELECT j.id, j.song_id, j.status, j.stage, j.progress, j.attempts, j.failure_reason, j.created_at, j.started_at, j.completed_at, j.updated_at, s.title, s.artist
      FROM music_import_jobs j JOIN music_songs s ON s.id = j.song_id ORDER BY j.created_at DESC LIMIT 200`).all();
    return Response.json({ jobs: jobs.results ?? [] });
  } catch (error) {
    return Response.json({ error: safeError(error) }, { status: 500 });
  }
}

