import { env } from "cloudflare:workers";
import type { ImportedSongRow } from "./types";

const CREATE_SONGS = `CREATE TABLE IF NOT EXISTS music_songs (
  id TEXT PRIMARY KEY NOT NULL,
  provider TEXT NOT NULL,
  provider_song_id TEXT NOT NULL,
  title TEXT NOT NULL,
  artist TEXT NOT NULL,
  artist_id TEXT,
  album TEXT,
  genre TEXT,
  release_year INTEGER,
  duration INTEGER NOT NULL,
  license TEXT NOT NULL,
  license_url TEXT NOT NULL,
  artwork_url TEXT,
  source_url TEXT NOT NULL,
  clip_start_seconds REAL NOT NULL DEFAULT 0,
  storage_folder TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  failure_reason TEXT,
  provider_response TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
)`;

const CREATE_JOBS = `CREATE TABLE IF NOT EXISTS music_import_jobs (
  id TEXT PRIMARY KEY NOT NULL,
  song_id TEXT NOT NULL REFERENCES music_songs(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'QUEUED',
  stage TEXT NOT NULL DEFAULT 'PREPARING',
  progress INTEGER NOT NULL DEFAULT 0,
  attempts INTEGER NOT NULL DEFAULT 0,
  failure_reason TEXT,
  created_at TEXT NOT NULL,
  started_at TEXT,
  completed_at TEXT,
  updated_at TEXT NOT NULL
)`;

const CREATE_PUZZLES = `CREATE TABLE IF NOT EXISTS daily_puzzles (
  id TEXT PRIMARY KEY NOT NULL,
  date_key TEXT NOT NULL UNIQUE,
  puzzle_number INTEGER NOT NULL UNIQUE,
  song_id TEXT NOT NULL REFERENCES music_songs(id),
  status TEXT NOT NULL DEFAULT 'SCHEDULED',
  created_at TEXT NOT NULL
)`;

const CREATE_GAME_SESSIONS = `CREATE TABLE IF NOT EXISTS daily_game_sessions (
  id TEXT PRIMARY KEY NOT NULL,
  anonymous_token_hash TEXT NOT NULL,
  puzzle_id TEXT NOT NULL REFERENCES daily_puzzles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'IN_PROGRESS',
  current_attempt INTEGER NOT NULL DEFAULT 0,
  attempts_json TEXT NOT NULL DEFAULT '[]',
  completed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
)`;

const CREATE_MUTATIONS = `CREATE TABLE IF NOT EXISTS game_mutations (
  id TEXT PRIMARY KEY NOT NULL,
  game_session_id TEXT NOT NULL REFERENCES daily_game_sessions(id) ON DELETE CASCADE,
  idempotency_key TEXT NOT NULL,
  response_json TEXT NOT NULL,
  created_at TEXT NOT NULL
)`;

export function getD1(): D1Database {
  if (!env.DB) throw new Error("D1 binding DB is not configured.");
  return env.DB;
}

export function getMusicBucket(): R2Bucket {
  if (!env.MUSIC_BUCKET) throw new Error("R2 binding MUSIC_BUCKET is not configured.");
  return env.MUSIC_BUCKET;
}

export async function ensureMusicSchema(): Promise<D1Database> {
  const db = getD1();
  await db.batch([
    db.prepare(CREATE_SONGS),
    db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS music_provider_song_unique ON music_songs(provider, provider_song_id)"),
    db.prepare(CREATE_JOBS),
    db.prepare("CREATE INDEX IF NOT EXISTS music_jobs_status_idx ON music_import_jobs(status, created_at)"),
    db.prepare(CREATE_PUZZLES),
    db.prepare(CREATE_GAME_SESSIONS),
    db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS daily_session_token_puzzle_unique ON daily_game_sessions(anonymous_token_hash, puzzle_id)"),
    db.prepare(CREATE_MUTATIONS),
    db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS game_mutation_session_key_unique ON game_mutations(game_session_id, idempotency_key)"),
  ]);
  return db;
}

export async function findSongByProvider(provider: string, providerSongId: string): Promise<ImportedSongRow | null> {
  const db = await ensureMusicSchema();
  return db.prepare("SELECT * FROM music_songs WHERE provider = ? AND provider_song_id = ? LIMIT 1").bind(provider, providerSongId).first<ImportedSongRow>();
}

export async function markImportFailed(jobId: string, songId: string, reason: string): Promise<void> {
  const db = await ensureMusicSchema();
  const now = new Date().toISOString();
  await db.batch([
    db.prepare("UPDATE music_import_jobs SET status = 'FAILED', stage = 'FAILED', progress = 100, failure_reason = ?, completed_at = ?, updated_at = ? WHERE id = ?").bind(reason.slice(0, 1000), now, now, jobId),
    db.prepare("UPDATE music_songs SET status = 'FAILED', failure_reason = ?, updated_at = ? WHERE id = ?").bind(reason.slice(0, 1000), now, songId),
  ]);
}
