import { getOrCreateSession, getTodayPuzzle, publicGame, revealedAnswer, sessionCookie } from "@/server/game/dailyService";
import { SNIPPET_LENGTHS } from "@/features/game/types";

export async function GET(request: Request) {
  const puzzle = await getTodayPuzzle();
  if (!puzzle) return Response.json({ scheduled: false }, { status: 404 });
  const { session, token, isNewToken } = await getOrCreateSession(request, puzzle.id);
  const nextDate = new Date(`${puzzle.date_key}T00:00:00Z`);
  nextDate.setUTCDate(nextDate.getUTCDate() + 1);
  const response = Response.json({
    scheduled: true,
    puzzle: { id: puzzle.id, number: puzzle.puzzle_number, dateKey: puzzle.date_key, mode: "DAILY", maxAttempts: 6, snippetLengthsSeconds: SNIPPET_LENGTHS, nextPuzzleAt: nextDate.toISOString() },
    game: publicGame(session),
    ...(session.status !== "IN_PROGRESS" ? { answer: revealedAnswer(puzzle) } : {}),
  });
  if (isNewToken) response.headers.set("set-cookie", sessionCookie(token, request));
  return response;
}
