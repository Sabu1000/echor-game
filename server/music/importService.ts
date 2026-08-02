import { ensureMusicSchema, findSongByProvider } from "./database";
import { getProvider } from "./providers";
import type { ProviderSong } from "./types";

export async function queueProviderSong(providerName: string, providerSongId: string, clipStartSeconds = 0): Promise<{ songId: string; jobId: string; duplicate: boolean }> {
  const existing = await findSongByProvider(providerName, providerSongId);
  if (existing) return { songId: existing.id, jobId: "", duplicate: true };

  const provider = getProvider(providerName);
  const song = await provider.getMetadata(providerSongId);
  const decision = provider.validateLicense(song);
  if (!decision.allowed) throw new Error(`License rejected: ${decision.reason}`);
  if (song.duration < 16 + clipStartSeconds) throw new Error("Track is too short for the configured clip start.");
  if (!song.downloadUrl) throw new Error("No downloadable source is available for this track.");

  const db = await ensureMusicSchema();
  const songId = crypto.randomUUID();
  const jobId = crypto.randomUUID();
  const now = new Date().toISOString();
  const storageFolder = `songs/${songId}`;
  await db.batch([
    db.prepare(`INSERT INTO music_songs (
      id, provider, provider_song_id, title, artist, artist_id, album, genre,
      release_year, duration, license, license_url, artwork_url, source_url,
      clip_start_seconds, storage_folder, status, provider_response, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', ?, ?, ?)`)
      .bind(songId, song.provider, song.providerSongId, song.title, song.artist, song.artistId ?? null, song.album ?? null, song.genre ?? null, song.releaseYear ?? null, song.duration, song.license, song.licenseUrl, song.artworkUrl ?? null, song.downloadUrl, Math.max(0, clipStartSeconds), storageFolder, JSON.stringify(song.providerResponse), now, now),
    db.prepare("INSERT INTO music_import_jobs (id, song_id, status, stage, progress, attempts, created_at, updated_at) VALUES (?, ?, 'QUEUED', 'PREPARING', 0, 0, ?, ?)")
      .bind(jobId, songId, now, now),
  ]);
  return { songId, jobId, duplicate: false };
}

export function serializeProviderSong(song: ProviderSong) {
  return {
    provider: song.provider,
    providerSongId: song.providerSongId,
    title: song.title,
    artist: song.artist,
    artistId: song.artistId,
    album: song.album,
    genre: song.genre,
    releaseYear: song.releaseYear,
    duration: song.duration,
    license: song.license,
    licenseUrl: song.licenseUrl,
    artworkUrl: song.artworkUrl,
    previewUrl: song.previewUrl,
    downloadAllowed: song.downloadAllowed,
  };
}
