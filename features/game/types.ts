export const SNIPPET_LENGTHS = [0.1, 0.5, 1, 2, 5, 16] as const;

export type GameMode = "DAILY" | "UNLIMITED" | "CUSTOM";
export type AttemptResult = "SKIPPED" | "WRONG" | "ARTIST_MATCH" | "CORRECT";
export type GameStatus = "IN_PROGRESS" | "WON" | "LOST";

export interface Song {
  id: string;
  title: string;
  artist: string;
  artistId: string;
  album: string;
  year: number;
  genre: string;
  colors: [string, string];
  notes: number[];
}

export interface Attempt {
  attemptNumber: number;
  result: AttemptResult;
  songId?: string;
}

export interface GameSession {
  puzzleId: string;
  puzzleNumber: number;
  dateKey: string;
  mode: GameMode;
  answerId: string;
  status: GameStatus;
  currentAttempt: number;
  attempts: Attempt[];
  statsSaved: boolean;
  customMessage?: string;
}

export interface PlayerStats {
  gamesPlayed: number;
  gamesWon: number;
  currentStreak: number;
  maxStreak: number;
  winDistribution: Record<string, number>;
  lastCompletedDateKey: string | null;
}

