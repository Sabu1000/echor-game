import { ensureMusicSchema } from "@/server/music/database";

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q")?.trim().slice(0, 100) ?? "";
  if (query.length < 2) return Response.json({ results: [] });
  const db = await ensureMusicSchema();
  const like = `%${query.replace(/[\\%_]/g, "\\$&")}%`;
  const rows = await db.prepare(`SELECT id, title, artist, album, release_year FROM music_songs
    WHERE status = 'READY' AND (title LIKE ? ESCAPE '\\' OR artist LIKE ? ESCAPE '\\')
    ORDER BY CASE WHEN lower(title) = lower(?) THEN 0 WHEN lower(title) LIKE lower(?) THEN 1 ELSE 2 END, title ASC LIMIT 12`)
    .bind(like, like, query, `${query}%`).all();
  return Response.json({ results: (rows.results ?? []).map((row) => {
    const item = row as Record<string, unknown>;
    return { id: item.id, title: item.title, artistDisplay: item.artist, album: item.album, releaseYear: item.release_year };
  }) });
}
