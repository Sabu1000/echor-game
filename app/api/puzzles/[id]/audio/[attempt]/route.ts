import { getMusicBucket } from "@/server/music/database";
import { getPuzzleById, requireSession } from "@/server/game/dailyService";
import { SNIPPET_LENGTHS } from "@/features/game/types";

export async function GET(request: Request, context: { params: Promise<{ id: string; attempt: string }> }) {
  const { id, attempt: attemptText } = await context.params;
  const attempt = Number(attemptText);
  if (!Number.isInteger(attempt) || attempt < 1 || attempt > 6) return Response.json({ error: "Invalid attempt number." }, { status: 400 });
  const session = await requireSession(request, id);
  if (!session) return Response.json({ error: "Game session not found." }, { status: 401 });
  if (session.status === "IN_PROGRESS" && attempt > session.current_attempt + 1) return Response.json({ error: "That clip is still locked." }, { status: 403 });
  const puzzle = await getPuzzleById(id);
  if (!puzzle) return Response.json({ error: "Puzzle not found." }, { status: 404 });
  const object = await getMusicBucket().get(`${puzzle.storage_folder}/clip-${attempt}.m4a`);
  if (!object) return Response.json({ error: "Audio clip is unavailable." }, { status: 404 });
  return new Response(object.body, { headers: { "content-type": object.httpMetadata?.contentType ?? "audio/mp4", "cache-control": "private, no-store", "accept-ranges": "none", "x-content-type-options": "nosniff", "x-snippet-duration": String(SNIPPET_LENGTHS[attempt - 1]) } });
}
