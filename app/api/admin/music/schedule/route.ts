import { requireAdmin, safeError } from "@/server/music/auth";
import { ensureMusicSchema, getMusicBucket } from "@/server/music/database";

export async function GET(request: Request) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  try {
    const db = await ensureMusicSchema();
    const puzzles = await db.prepare(`SELECT p.id, p.date_key, p.puzzle_number, p.status, s.id AS song_id, s.title, s.artist, s.artwork_url
      FROM daily_puzzles p JOIN music_songs s ON s.id = p.song_id ORDER BY p.date_key DESC LIMIT 100`).all();
    return Response.json({ puzzles: puzzles.results ?? [] });
  } catch (error) {
    return Response.json({ error: safeError(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  try {
    const payload = await request.json() as { dateKey?: string; songId?: string; puzzleNumber?: number };
    if (!payload.dateKey || !/^\d{4}-\d{2}-\d{2}$/.test(payload.dateKey) || !payload.songId) return Response.json({ error: "A valid dateKey and songId are required." }, { status: 400 });
    const db = await ensureMusicSchema();
    const song = await db.prepare("SELECT id, storage_folder, status FROM music_songs WHERE id = ?").bind(payload.songId).first<{ id: string; storage_folder: string; status: string }>();
    if (!song || song.status !== "READY") return Response.json({ error: "Only READY songs can be scheduled." }, { status: 422 });
    const bucket = getMusicBucket();
    for (let index = 1; index <= 6; index += 1) {
      if (!await bucket.head(`${song.storage_folder}/clip-${index}.m4a`)) return Response.json({ error: `Clip ${index} is missing; the song cannot be scheduled.` }, { status: 422 });
    }
    const existing = await db.prepare("SELECT id, puzzle_number FROM daily_puzzles WHERE date_key = ? LIMIT 1").bind(payload.dateKey).first<{ id: string; puzzle_number: number }>();
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    if (existing) {
      const sessionCount = await db.prepare("SELECT count(*) AS count FROM daily_game_sessions WHERE puzzle_id = ?").bind(existing.id).first<{ count: number }>();
      await db.batch([
        db.prepare("DELETE FROM game_mutations WHERE game_session_id IN (SELECT id FROM daily_game_sessions WHERE puzzle_id = ?)").bind(existing.id),
        db.prepare("DELETE FROM daily_game_sessions WHERE puzzle_id = ?").bind(existing.id),
        db.prepare("UPDATE daily_puzzles SET id = ?, song_id = ?, status = 'SCHEDULED', created_at = ? WHERE id = ?").bind(id, payload.songId, now, existing.id),
      ]);
      return Response.json({ id, scheduled: true, replaced: true, resetSessions: Number(sessionCount?.count ?? 0), puzzleNumber: existing.puzzle_number });
    }
    const number = Number(payload.puzzleNumber ?? Math.floor(Date.parse(`${payload.dateKey}T00:00:00Z`) / 86_400_000));
    await db.prepare("INSERT INTO daily_puzzles (id, date_key, puzzle_number, song_id, status, created_at) VALUES (?, ?, ?, ?, 'SCHEDULED', ?)").bind(id, payload.dateKey, number, payload.songId, now).run();
    return Response.json({ id, scheduled: true, replaced: false, resetSessions: 0, puzzleNumber: number }, { status: 201 });
  } catch (error) {
    const message = safeError(error);
    return Response.json({ error: message.includes("UNIQUE") ? "That date or puzzle number is already scheduled." : message }, { status: 500 });
  }
}
