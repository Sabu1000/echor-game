import { requireAdmin, safeError } from "@/server/music/auth";
import { getProvider } from "@/server/music/providers";
import { serializeProviderSong } from "@/server/music/importService";

export async function GET(request: Request) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  try {
    const query = new URL(request.url).searchParams;
    const provider = getProvider(query.get("provider") ?? "jamendo");
    const songs = await provider.searchSongs({
      keyword: query.get("q")?.slice(0, 100),
      genre: query.get("genre")?.slice(0, 40),
      artist: query.get("artist")?.slice(0, 100),
      minimumLength: Number(query.get("minimumLength") ?? 60),
      maximumResults: Number(query.get("limit") ?? 25),
    });
    return Response.json({ results: songs.map((song) => ({ ...serializeProviderSong(song), licenseDecision: provider.validateLicense(song) })) });
  } catch (error) {
    return Response.json({ error: safeError(error) }, { status: 502 });
  }
}

