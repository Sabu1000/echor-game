import { requireAdmin, safeError } from "@/server/music/auth";
import { queueProviderSong } from "@/server/music/importService";
import { getProvider } from "@/server/music/providers";

export async function POST(request: Request) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  try {
    const payload = await request.json() as { provider?: string; genre?: string; maximumSongs?: number; minimumLength?: number; clipStartSeconds?: number };
    const provider = getProvider(payload.provider ?? "jamendo");
    const maximumSongs = Math.min(100, Math.max(1, Number(payload.maximumSongs ?? 25)));
    const songs = await provider.searchSongs({ genre: payload.genre, minimumLength: Number(payload.minimumLength ?? 60), maximumResults: maximumSongs });
    const summary = { queued: 0, duplicates: 0, rejected: 0, jobs: [] as string[] };
    for (const song of songs) {
      const decision = provider.validateLicense(song);
      if (!decision.allowed) { summary.rejected += 1; continue; }
      try {
        const result = await queueProviderSong(provider.name, song.providerSongId, Number(payload.clipStartSeconds ?? 0));
        if (result.duplicate) summary.duplicates += 1;
        else { summary.queued += 1; summary.jobs.push(result.jobId); }
      } catch { summary.rejected += 1; }
    }
    return Response.json(summary, { status: 202 });
  } catch (error) {
    return Response.json({ error: safeError(error) }, { status: 500 });
  }
}

