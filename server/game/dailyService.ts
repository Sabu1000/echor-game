import { ensureMusicSchema } from "@/server/music/database";
import { SNIPPET_LENGTHS, type AttemptResult } from "@/features/game/types";

export interface StoredAttempt {
  attemptNumber: number;
  result: AttemptResult;
  guessedSong?: { id: string; title: string; artistDisplay: string };
}

export interface DailyPuzzleRow {
  id: string;
  date_key: string;
  puzzle_number: number;
  song_id: string;
  title: string;
  artist: string;
  artist_id: string | null;
  album: string | null;
  release_year: number | null;
  genre: string | null;
  artwork_url: string | null;
  storage_folder: string;
}

export interface DailySessionRow {
  id: string;
  anonymous_token_hash: string;
  puzzle_id: string;
  status: "IN_PROGRESS" | "WON" | "LOST";
  current_attempt: number;
  attempts_json: string;
  completed_at: string | null;
}

export function dateKey(): string { return new Date().toISOString().slice(0, 10); }

export function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get("cookie") ?? "";
  for (const part of header.split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) return decodeURIComponent(value.join("="));
  }
  return null;
}

export async function tokenHash(token: string): Promise<string> {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function sessionCookie(token: string, request: Request): string {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `echor_session=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000${secure}`;
}

export async function getTodayPuzzle(): Promise<DailyPuzzleRow | null> {
  const db = await ensureMusicSchema();
  return db.prepare(`SELECT p.id, p.date_key, p.puzzle_number, p.song_id, s.title, s.artist, s.artist_id, s.album, s.release_year, s.genre, s.artwork_url, s.storage_folder
    FROM daily_puzzles p JOIN music_songs s ON s.id = p.song_id
    WHERE p.date_key = ? AND p.status IN ('SCHEDULED', 'PUBLISHED') AND s.status = 'READY' LIMIT 1`).bind(dateKey()).first<DailyPuzzleRow>();
}

export async function getPuzzleById(id: string): Promise<DailyPuzzleRow | null> {
  const db = await ensureMusicSchema();
  return db.prepare(`SELECT p.id, p.date_key, p.puzzle_number, p.song_id, s.title, s.artist, s.artist_id, s.album, s.release_year, s.genre, s.artwork_url, s.storage_folder
    FROM daily_puzzles p JOIN music_songs s ON s.id = p.song_id
    WHERE p.id = ? AND p.status IN ('SCHEDULED', 'PUBLISHED') AND s.status = 'READY' LIMIT 1`).bind(id).first<DailyPuzzleRow>();
}

export async function getOrCreateSession(request: Request, puzzleId: string): Promise<{ session: DailySessionRow; token: string; isNewToken: boolean }> {
  const db = await ensureMusicSchema();
  const existingToken = readCookie(request, "echor_session");
  const token = existingToken && existingToken.length >= 32 ? existingToken : crypto.randomUUID() + crypto.randomUUID();
  const hash = await tokenHash(token);
  let session = await db.prepare("SELECT * FROM daily_game_sessions WHERE anonymous_token_hash = ? AND puzzle_id = ? LIMIT 1").bind(hash, puzzleId).first<DailySessionRow>();
  if (!session) {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    await db.prepare("INSERT INTO daily_game_sessions (id, anonymous_token_hash, puzzle_id, status, current_attempt, attempts_json, created_at, updated_at) VALUES (?, ?, ?, 'IN_PROGRESS', 0, '[]', ?, ?)").bind(id, hash, puzzleId, now, now).run();
    session = { id, anonymous_token_hash: hash, puzzle_id: puzzleId, status: "IN_PROGRESS", current_attempt: 0, attempts_json: "[]", completed_at: null };
  }
  return { session, token, isNewToken: !existingToken };
}

export async function requireSession(request: Request, puzzleId: string): Promise<DailySessionRow | null> {
  const token = readCookie(request, "echor_session");
  if (!token) return null;
  const db = await ensureMusicSchema();
  return db.prepare("SELECT * FROM daily_game_sessions WHERE anonymous_token_hash = ? AND puzzle_id = ? LIMIT 1").bind(await tokenHash(token), puzzleId).first<DailySessionRow>();
}

export function parseAttempts(session: DailySessionRow): StoredAttempt[] {
  try { return JSON.parse(session.attempts_json) as StoredAttempt[]; } catch { return []; }
}

export function publicGame(session: DailySessionRow) {
  const attempts = parseAttempts(session);
  return {
    status: session.status,
    currentAttempt: session.current_attempt,
    attempts,
    unlockedDurationSeconds: SNIPPET_LENGTHS[Math.min(session.current_attempt, 5)],
    completedAt: session.completed_at,
  };
}

export function revealedAnswer(puzzle: DailyPuzzleRow) {
  return { title: puzzle.title, artistDisplay: puzzle.artist, album: puzzle.album, releaseYear: puzzle.release_year, genre: puzzle.genre, artworkUrl: puzzle.artwork_url };
}

export async function applyMutation(request: Request, puzzleId: string, kind: "guess" | "skip", songId?: string): Promise<Response> {
  const idempotencyKey = request.headers.get("idempotency-key");
  if (!idempotencyKey || idempotencyKey.length < 8 || idempotencyKey.length > 100) return Response.json({ error: "A valid Idempotency-Key header is required." }, { status: 400 });
  const session = await requireSession(request, puzzleId);
  if (!session) return Response.json({ error: "Game session not found. Reload the puzzle." }, { status: 401 });
  const db = await ensureMusicSchema();
  const cached = await db.prepare("SELECT response_json FROM game_mutations WHERE game_session_id = ? AND idempotency_key = ? LIMIT 1").bind(session.id, idempotencyKey).first<{ response_json: string }>();
  if (cached) return Response.json(JSON.parse(cached.response_json));
  if (session.status !== "IN_PROGRESS") return Response.json({ error: "This game is already complete." }, { status: 409 });
  const puzzle = await getPuzzleById(puzzleId);
  if (!puzzle) return Response.json({ error: "Puzzle not found." }, { status: 404 });
  const attempts = parseAttempts(session);
  let result: AttemptResult = "SKIPPED";
  let guessedSong: StoredAttempt["guessedSong"];
  if (kind === "guess") {
    if (!songId) return Response.json({ error: "songId is required." }, { status: 400 });
    if (attempts.some((attempt) => attempt.guessedSong?.id === songId)) return Response.json({ code: "DUPLICATE_GUESS", message: "You already guessed that song." }, { status: 409 });
    const guessed = await db.prepare("SELECT id, title, artist, artist_id FROM music_songs WHERE id = ? AND status = 'READY' LIMIT 1").bind(songId).first<{ id: string; title: string; artist: string; artist_id: string | null }>();
    if (!guessed) return Response.json({ error: "Selected song is unavailable." }, { status: 422 });
    guessedSong = { id: guessed.id, title: guessed.title, artistDisplay: guessed.artist };
    result = guessed.id === puzzle.song_id ? "CORRECT" : guessed.artist_id && puzzle.artist_id && guessed.artist_id === puzzle.artist_id ? "ARTIST_MATCH" : "WRONG";
  }
  const nextAttempt = attempts.length + 1;
  const attempt: StoredAttempt = { attemptNumber: nextAttempt, result, guessedSong };
  const nextAttempts = [...attempts, attempt];
  const status = result === "CORRECT" ? "WON" : nextAttempts.length >= 6 ? "LOST" : "IN_PROGRESS";
  const currentAttempt = result === "CORRECT" ? session.current_attempt : Math.min(nextAttempts.length, 5);
  const completedAt = status === "IN_PROGRESS" ? null : new Date().toISOString();
  const updated = await db.prepare("UPDATE daily_game_sessions SET status = ?, current_attempt = ?, attempts_json = ?, completed_at = ?, updated_at = ? WHERE id = ? AND status = 'IN_PROGRESS' AND current_attempt = ?")
    .bind(status, currentAttempt, JSON.stringify(nextAttempts), completedAt, new Date().toISOString(), session.id, session.current_attempt).run();
  const changes = Number((updated.meta as { changes?: number } | undefined)?.changes ?? 1);
  if (changes === 0) return Response.json({ error: "Game state changed in another tab. Reloading is required." }, { status: 409 });
  const nextSession: DailySessionRow = { ...session, status, current_attempt: currentAttempt, attempts_json: JSON.stringify(nextAttempts), completed_at: completedAt };
  const response = { attempt, game: publicGame(nextSession), ...(status !== "IN_PROGRESS" ? { answer: revealedAnswer(puzzle) } : {}) };
  await db.prepare("INSERT INTO game_mutations (id, game_session_id, idempotency_key, response_json, created_at) VALUES (?, ?, ?, ?, ?)").bind(crypto.randomUUID(), session.id, idempotencyKey, JSON.stringify(response), new Date().toISOString()).run();
  return Response.json(response);
}
