import { SONGS } from "./catalog";
import type { AttemptResult, GameMode, GameSession, PlayerStats, Song } from "./types";

export const EMPTY_STATS: PlayerStats = {
  gamesPlayed: 0,
  gamesWon: 0,
  currentStreak: 0,
  maxStreak: 0,
  winDistribution: { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0, "6": 0 },
  lastCompletedDateKey: null,
};

export function utcDateKey(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

export function puzzleNumber(dateKey: string): number {
  const epoch = Date.UTC(2026, 0, 1);
  const today = Date.parse(`${dateKey}T00:00:00Z`);
  return 420 + Math.floor((today - epoch) / 86_400_000);
}

export function hashString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function dailySong(dateKey: string): Song {
  return SONGS[hashString(`echor-${dateKey}`) % SONGS.length];
}

export function createSession(
  mode: GameMode,
  seed: string,
  answerId?: string,
  customMessage?: string,
): GameSession {
  const dateKey = utcDateKey();
  const daily = mode === "DAILY";
  const answer = daily ? dailySong(dateKey) : SONGS[hashString(seed) % SONGS.length];
  return {
    puzzleId: daily ? `daily-${dateKey}` : `${mode.toLowerCase()}-${seed}`,
    puzzleNumber: daily ? puzzleNumber(dateKey) : hashString(seed) % 9000,
    dateKey,
    mode,
    answerId: answerId ?? answer.id,
    status: "IN_PROGRESS",
    currentAttempt: 0,
    attempts: [],
    statsSaved: false,
    customMessage,
  };
}

export function evaluateGuess(answer: Song, guess: Song): AttemptResult {
  if (answer.id === guess.id) return "CORRECT";
  if (answer.artistId === guess.artistId) return "ARTIST_MATCH";
  return "WRONG";
}

export function submitAttempt(
  session: GameSession,
  result: AttemptResult,
  songId?: string,
): GameSession {
  if (session.status !== "IN_PROGRESS") return session;
  const attempt = { attemptNumber: session.currentAttempt + 1, result, songId };
  const attempts = [...session.attempts, attempt];
  const won = result === "CORRECT";
  const exhausted = attempts.length >= 6;
  return {
    ...session,
    attempts,
    currentAttempt: Math.min(attempts.length, 5),
    status: won ? "WON" : exhausted ? "LOST" : "IN_PROGRESS",
  };
}

export function isDuplicate(session: GameSession, songId: string): boolean {
  return session.attempts.some((attempt) => attempt.songId === songId);
}

export function updateStats(stats: PlayerStats, session: GameSession): PlayerStats {
  if (session.statsSaved || session.mode !== "DAILY" || session.status === "IN_PROGRESS") return stats;
  const won = session.status === "WON";
  const previousDate = new Date(`${session.dateKey}T00:00:00Z`);
  previousDate.setUTCDate(previousDate.getUTCDate() - 1);
  const isConsecutive = stats.lastCompletedDateKey === utcDateKey(previousDate);
  const currentStreak = won ? (isConsecutive ? stats.currentStreak + 1 : 1) : 0;
  const distribution = { ...stats.winDistribution };
  if (won) distribution[String(session.attempts.length)] = (distribution[String(session.attempts.length)] ?? 0) + 1;
  return {
    gamesPlayed: stats.gamesPlayed + 1,
    gamesWon: stats.gamesWon + (won ? 1 : 0),
    currentStreak,
    maxStreak: Math.max(stats.maxStreak, currentStreak),
    winDistribution: distribution,
    lastCompletedDateKey: session.dateKey,
  };
}

export function shareText(session: GameSession): string {
  const symbols: Record<AttemptResult, string> = {
    WRONG: "🟥",
    ARTIST_MATCH: "🟨",
    CORRECT: "🟩",
    SKIPPED: "⬜",
  };
  const score = session.status === "WON" ? `${session.attempts.length}/6` : "X/6";
  const grid = session.attempts.map((attempt) => symbols[attempt.result]).join("") + "⬛".repeat(6 - session.attempts.length);
  const duration = [0.1, 0.5, 1, 2, 5, 16][Math.max(0, session.attempts.length - 1)];
  return `ECHOR #${session.puzzleNumber} ${score}\n${grid}\n🔊 ${duration}s\n${typeof window === "undefined" ? "" : window.location.origin}`;
}

