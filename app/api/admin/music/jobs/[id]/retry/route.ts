import { requireAdmin, safeError } from "@/server/music/auth";
import { ensureMusicSchema } from "@/server/music/database";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  try {
    const { id } = await context.params;
    const db = await ensureMusicSchema();
    const job = await db.prepare("SELECT song_id FROM music_import_jobs WHERE id = ? AND status = 'FAILED'").bind(id).first<{ song_id: string }>();
    if (!job) return Response.json({ error: "Failed import job not found." }, { status: 404 });
    const now = new Date().toISOString();
    await db.batch([
      db.prepare("UPDATE music_import_jobs SET status = 'QUEUED', stage = 'PREPARING', progress = 0, failure_reason = NULL, completed_at = NULL, updated_at = ? WHERE id = ?").bind(now, id),
      db.prepare("UPDATE music_songs SET status = 'PENDING', failure_reason = NULL, updated_at = ? WHERE id = ?").bind(now, job.song_id),
    ]);
    return Response.json({ queued: true });
  } catch (error) {
    return Response.json({ error: safeError(error) }, { status: 500 });
  }
}
