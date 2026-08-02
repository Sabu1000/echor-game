declare module "cloudflare:workers" {
  export const env: {
    DB?: D1Database;
    MUSIC_BUCKET?: R2Bucket;
    JAMENDO_CLIENT_ID?: string;
    AUDIO_PROCESSOR_URL?: string;
    AUDIO_PROCESSOR_TOKEN?: string;
    ADMIN_EMAILS?: string;
    ALLOWED_LICENSE_URL_PREFIXES?: string;
  };
}

interface D1Result<T = unknown> { success: boolean; results?: T[]; meta?: Record<string, unknown>; error?: string; }
interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = Record<string, unknown>>(column?: string): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  run<T = Record<string, unknown>>(): Promise<D1Result<T>>;
}
interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
}
interface R2ObjectBody { body: ReadableStream; arrayBuffer(): Promise<ArrayBuffer>; httpMetadata?: { contentType?: string }; }
interface R2Bucket {
  put(key: string, value: ArrayBuffer | Uint8Array | ReadableStream, options?: { httpMetadata?: { contentType?: string }; customMetadata?: Record<string, string> }): Promise<unknown>;
  get(key: string): Promise<R2ObjectBody | null>;
  head(key: string): Promise<unknown | null>;
  delete(key: string | string[]): Promise<void>;
}
interface Fetcher { fetch(request: Request): Promise<Response>; }
