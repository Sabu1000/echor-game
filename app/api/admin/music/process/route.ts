import { env } from "cloudflare:workers";
import { requireAdmin, safeError } from "@/server/music/auth";
import { ensureMusicSchema, getMusicBucket, markImportFailed } from "@/server/music/database";
import { getProvider } from "@/server/music/providers";
import type { ImportedSongRow } from "@/server/music/types";
import { SNIPPET_LENGTHS } from "@/features/game/types";

interface JobRow { id: string; song_id: string; status: string; }
interface ProcessorClip { index: number; durationSeconds: number; contentType: string; dataBase64: string; }
interface ProcessorResponse { clips?: ProcessorClip[]; error?: string; }

function decodeBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

export async function POST(request: Request) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  let job: JobRow | null = null;
  try {
    if (!env.AUDIO_PROCESSOR_URL || !env.AUDIO_PROCESSOR_TOKEN) {
      return Response.json({ error: "The FFmpeg worker is not configured. Set AUDIO_PROCESSOR_URL and AUDIO_PROCESSOR_TOKEN." }, { status: 503 });
    }
    const db = await ensureMusicSchema();
    job = await db.prepare("SELECT id, song_id, status FROM music_import_jobs WHERE status = 'QUEUED' ORDER BY created_at ASC LIMIT 1").first<JobRow>();
    if (!job) return Response.json({ processed: false, message: "The queue is empty." });
    const now = new Date().toISOString();
    const claimed = await db.prepare("UPDATE music_import_jobs SET status = 'PROCESSING', stage = 'DOWNLOADING', progress = 15, attempts = attempts + 1, started_at = ?, updated_at = ? WHERE id = ? AND status = 'QUEUED'").bind(now, now, job.id).run();
    if (!claimed.success) return Response.json({ processed: false, message: "Job was claimed by another worker." }, { status: 409 });
    await db.prepare("UPDATE music_songs SET status = 'PROCESSING', updated_at = ? WHERE id = ?").bind(now, job.song_id).run();

    const song = await db.prepare("SELECT * FROM music_songs WHERE id = ?").bind(job.song_id).first<ImportedSongRow>();
    if (!song) throw new Error("Queued song record was not found.");
    const provider = getProvider(song.provider);
    const fresh = await provider.getMetadata(song.provider_song_id);
    const license = provider.validateLicense(fresh);
    if (!license.allowed) throw new Error(`License revalidation failed: ${license.reason}`);
    if (!fresh.downloadUrl) throw new Error("The provider no longer offers a downloadable source.");

    await db.prepare("UPDATE music_import_jobs SET stage = 'GENERATING_CLIPS', progress = 45, updated_at = ? WHERE id = ?").bind(new Date().toISOString(), job.id).run();
    const processorResponse = await fetch(`${env.AUDIO_PROCESSOR_URL.replace(/\/$/, "")}/process`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${env.AUDIO_PROCESSOR_TOKEN}` },
      body: JSON.stringify({
        sourceUrl: fresh.downloadUrl,
        clipStartSeconds: song.clip_start_seconds,
        durations: SNIPPET_LENGTHS,
        codec: "aac",
        bitrate: "192k",
        loudness: { integrated: -16, truePeak: -1.5, range: 11 },
        fadeOutMilliseconds: 5,
      }),
      signal: AbortSignal.timeout(180_000),
    });
    const processed = await processorResponse.json() as ProcessorResponse;
    if (!processorResponse.ok || processed.error) throw new Error(processed.error || `FFmpeg worker returned HTTP ${processorResponse.status}.`);
    if (!processed.clips || processed.clips.length !== SNIPPET_LENGTHS.length) throw new Error("FFmpeg worker did not return all six clips.");
    processed.clips.sort((a, b) => a.index - b.index).forEach((clip, index) => {
      if (clip.index !== index + 1 || Math.abs(clip.durationSeconds - SNIPPET_LENGTHS[index]) > 0.08) throw new Error(`Clip ${index + 1} failed duration validation.`);
      if (!clip.dataBase64) throw new Error(`Clip ${index + 1} is empty.`);
    });

    await db.prepare("UPDATE music_import_jobs SET stage = 'UPLOADING', progress = 80, updated_at = ? WHERE id = ?").bind(new Date().toISOString(), job.id).run();
    const bucket = getMusicBucket();
    const uploadedKeys: string[] = [];
    try {
      for (const clip of processed.clips) {
        const key = `${song.storage_folder}/clip-${clip.index}.m4a`;
        await bucket.put(key, decodeBase64(clip.dataBase64), {
          httpMetadata: { contentType: "audio/mp4" },
          customMetadata: { duration: String(clip.durationSeconds), songId: song.id },
        });
        uploadedKeys.push(key);
      }
    } catch (error) {
      if (uploadedKeys.length) await bucket.delete(uploadedKeys);
      throw error;
    }

    const completedAt = new Date().toISOString();
    await db.batch([
      db.prepare("UPDATE music_import_jobs SET status = 'COMPLETED', stage = 'COMPLETED', progress = 100, completed_at = ?, updated_at = ? WHERE id = ?").bind(completedAt, completedAt, job.id),
      db.prepare("UPDATE music_songs SET status = 'READY', source_url = '', failure_reason = NULL, provider_response = ?, updated_at = ? WHERE id = ?").bind(JSON.stringify(fresh.providerResponse), completedAt, song.id),
    ]);
    return Response.json({ processed: true, jobId: job.id, songId: song.id, status: "READY" });
  } catch (error) {
    const reason = safeError(error);
    if (job) await markImportFailed(job.id, job.song_id, reason);
    return Response.json({ error: reason, jobId: job?.id }, { status: 500 });
  }
}

