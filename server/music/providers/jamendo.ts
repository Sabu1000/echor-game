import type { LicenseDecision, MusicProvider, ProviderSearchParams, ProviderSong } from "../types";

interface JamendoTrack {
  id: string;
  name: string;
  duration: number;
  artist_id?: string;
  artist_name: string;
  album_name?: string;
  releasedate?: string;
  license_ccurl?: string;
  album_image?: string;
  image?: string;
  audio?: string;
  audiodownload?: string;
  audiodownload_allowed?: boolean;
  musicinfo?: { tags?: { genres?: string[] } };
}

interface JamendoResponse {
  headers?: { status?: string; error_message?: string; code?: number };
  results?: JamendoTrack[];
}

function describeLicense(url: string): string {
  if (url.includes("publicdomain/zero")) return "CC0";
  const match = url.match(/licenses\/([^/]+)\/(\d\.\d)/i);
  return match ? `CC ${match[1].toUpperCase()} ${match[2]}` : url || "Unknown";
}

function mapTrack(track: JamendoTrack): ProviderSong {
  const licenseUrl = track.license_ccurl ?? "";
  return {
    provider: "jamendo",
    providerSongId: String(track.id),
    title: track.name,
    artist: track.artist_name,
    artistId: track.artist_id ? String(track.artist_id) : undefined,
    album: track.album_name || undefined,
    genre: track.musicinfo?.tags?.genres?.[0],
    releaseYear: track.releasedate ? Number(track.releasedate.slice(0, 4)) || undefined : undefined,
    duration: Number(track.duration),
    license: describeLicense(licenseUrl),
    licenseUrl,
    artworkUrl: track.album_image || track.image || undefined,
    previewUrl: track.audio || undefined,
    downloadUrl: track.audiodownload || undefined,
    downloadAllowed: Boolean(track.audiodownload_allowed && track.audiodownload),
    providerResponse: track,
  };
}

export class JamendoProvider implements MusicProvider {
  readonly name = "jamendo" as const;
  constructor(private clientId: string, private allowedPrefixes: string[]) {}

  private async request(params: URLSearchParams): Promise<ProviderSong[]> {
    params.set("client_id", this.clientId);
    params.set("format", "json");
    params.set("include", "licenses musicinfo");
    params.set("audioformat", "mp32");
    params.set("audiodlformat", "mp32");
    params.set("imagesize", "300");
    const response = await fetch(`https://api.jamendo.com/v3.0/tracks/?${params.toString()}`, { signal: AbortSignal.timeout(15_000) });
    if (!response.ok) throw new Error(`Jamendo returned HTTP ${response.status}.`);
    const payload = await response.json() as JamendoResponse;
    if (payload.headers?.status === "failed") throw new Error(payload.headers.error_message || "Jamendo search failed.");
    return (payload.results ?? []).map(mapTrack);
  }

  async searchSongs(params: ProviderSearchParams): Promise<ProviderSong[]> {
    const query = new URLSearchParams();
    const combined = [params.keyword, params.artist].filter(Boolean).join(" ").trim();
    if (combined) query.set("search", combined.slice(0, 100));
    if (params.genre) query.set("fuzzytags", params.genre.toLowerCase().slice(0, 40));
    const minimum = Math.max(16, Math.floor(params.minimumLength ?? 60));
    query.set("durationbetween", `${minimum}_3600`);
    query.set("limit", String(Math.min(200, Math.max(1, params.maximumResults ?? 25))));
    query.set("order", "relevance");
    return this.request(query);
  }

  async getMetadata(providerSongId: string): Promise<ProviderSong> {
    if (!/^\d+$/.test(providerSongId)) throw new Error("Invalid Jamendo track id.");
    const songs = await this.request(new URLSearchParams({ id: providerSongId, limit: "1" }));
    if (!songs[0]) throw new Error("Jamendo track was not found.");
    return songs[0];
  }

  async downloadSong(song: ProviderSong): Promise<Response> {
    if (!song.downloadUrl) throw new Error("The provider did not return a downloadable source.");
    const response = await fetch(song.downloadUrl, { redirect: "follow", signal: AbortSignal.timeout(60_000) });
    if (!response.ok || !response.body) throw new Error(`Source download failed with HTTP ${response.status}.`);
    return response;
  }

  validateLicense(song: ProviderSong): LicenseDecision {
    if (!song.downloadAllowed) return { allowed: false, reason: "The artist has disabled downloads for this track." };
    if (!song.licenseUrl) return { allowed: false, reason: "No license URL was supplied by the provider." };
    const normalized = song.licenseUrl.replace(/^http:/, "https:");
    const blocked = /\/by-(?:nc|nd)|-(?:nc|nd)(?:-|\/)/i.test(normalized);
    if (blocked) return { allowed: false, reason: "The reported license restricts commercial use or derivatives." };
    const allowed = this.allowedPrefixes.some((prefix) => normalized.startsWith(prefix.replace(/^http:/, "https:")));
    return allowed
      ? { allowed: true, reason: "The license matches the configured allowlist." }
      : { allowed: false, reason: "The license is not in the configured production allowlist." };
  }
}

