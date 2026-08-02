export type MusicProviderName = "jamendo";
export type ImportStatus = "PENDING" | "PROCESSING" | "READY" | "FAILED" | "ARCHIVED";
export type QueueStage = "PREPARING" | "DOWNLOADING" | "GENERATING_CLIPS" | "UPLOADING" | "COMPLETED" | "FAILED";

export interface ProviderSearchParams {
  keyword?: string;
  genre?: string;
  artist?: string;
  minimumLength?: number;
  maximumResults?: number;
}

export interface ProviderSong {
  provider: MusicProviderName;
  providerSongId: string;
  title: string;
  artist: string;
  artistId?: string;
  album?: string;
  genre?: string;
  releaseYear?: number;
  duration: number;
  license: string;
  licenseUrl: string;
  artworkUrl?: string;
  previewUrl?: string;
  downloadUrl?: string;
  downloadAllowed: boolean;
  providerResponse: unknown;
}

export interface LicenseDecision {
  allowed: boolean;
  reason: string;
}

export interface MusicProvider {
  readonly name: MusicProviderName;
  searchSongs(params: ProviderSearchParams): Promise<ProviderSong[]>;
  getMetadata(providerSongId: string): Promise<ProviderSong>;
  downloadSong(song: ProviderSong): Promise<Response>;
  validateLicense(song: ProviderSong): LicenseDecision;
}

export interface ImportedSongRow {
  id: string;
  provider: string;
  provider_song_id: string;
  title: string;
  artist: string;
  artist_id: string | null;
  album: string | null;
  genre: string | null;
  release_year: number | null;
  duration: number;
  license: string;
  license_url: string;
  artwork_url: string | null;
  source_url: string;
  clip_start_seconds: number;
  storage_folder: string;
  status: ImportStatus;
  failure_reason: string | null;
  provider_response: string | null;
  created_at: string;
  updated_at: string;
}

