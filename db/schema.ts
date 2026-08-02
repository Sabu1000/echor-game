import { integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const musicSongs = sqliteTable("music_songs", {
  id: text("id").primaryKey(),
  provider: text("provider").notNull(),
  providerSongId: text("provider_song_id").notNull(),
  title: text("title").notNull(),
  artist: text("artist").notNull(),
  artistId: text("artist_id"),
  album: text("album"),
  genre: text("genre"),
  releaseYear: integer("release_year"),
  duration: integer("duration").notNull(),
  license: text("license").notNull(),
  licenseUrl: text("license_url").notNull(),
  artworkUrl: text("artwork_url"),
  sourceUrl: text("source_url").notNull(),
  clipStartSeconds: real("clip_start_seconds").notNull().default(0),
  storageFolder: text("storage_folder").notNull(),
  status: text("status", { enum: ["PENDING", "PROCESSING", "READY", "FAILED", "ARCHIVED"] }).notNull().default("PENDING"),
  failureReason: text("failure_reason"),
  providerResponse: text("provider_response"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [uniqueIndex("music_provider_song_unique").on(table.provider, table.providerSongId)]);

export const musicImportJobs = sqliteTable("music_import_jobs", {
  id: text("id").primaryKey(),
  songId: text("song_id").notNull().references(() => musicSongs.id, { onDelete: "cascade" }),
  status: text("status", { enum: ["QUEUED", "PROCESSING", "COMPLETED", "FAILED"] }).notNull().default("QUEUED"),
  stage: text("stage").notNull().default("PREPARING"),
  progress: integer("progress").notNull().default(0),
  attempts: integer("attempts").notNull().default(0),
  failureReason: text("failure_reason"),
  createdAt: text("created_at").notNull(),
  startedAt: text("started_at"),
  completedAt: text("completed_at"),
  updatedAt: text("updated_at").notNull(),
});

export const dailyPuzzles = sqliteTable("daily_puzzles", {
  id: text("id").primaryKey(),
  dateKey: text("date_key").notNull().unique(),
  puzzleNumber: integer("puzzle_number").notNull().unique(),
  songId: text("song_id").notNull().references(() => musicSongs.id),
  status: text("status", { enum: ["SCHEDULED", "PUBLISHED", "RETIRED"] }).notNull().default("SCHEDULED"),
  createdAt: text("created_at").notNull(),
});

export const dailyGameSessions = sqliteTable("daily_game_sessions", {
  id: text("id").primaryKey(),
  anonymousTokenHash: text("anonymous_token_hash").notNull(),
  puzzleId: text("puzzle_id").notNull().references(() => dailyPuzzles.id, { onDelete: "cascade" }),
  status: text("status", { enum: ["IN_PROGRESS", "WON", "LOST"] }).notNull().default("IN_PROGRESS"),
  currentAttempt: integer("current_attempt").notNull().default(0),
  attemptsJson: text("attempts_json").notNull().default("[]"),
  completedAt: text("completed_at"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [uniqueIndex("daily_session_token_puzzle_unique").on(table.anonymousTokenHash, table.puzzleId)]);

export const gameMutations = sqliteTable("game_mutations", {
  id: text("id").primaryKey(),
  gameSessionId: text("game_session_id").notNull().references(() => dailyGameSessions.id, { onDelete: "cascade" }),
  idempotencyKey: text("idempotency_key").notNull(),
  responseJson: text("response_json").notNull(),
  createdAt: text("created_at").notNull(),
}, (table) => [uniqueIndex("game_mutation_session_key_unique").on(table.gameSessionId, table.idempotencyKey)]);
