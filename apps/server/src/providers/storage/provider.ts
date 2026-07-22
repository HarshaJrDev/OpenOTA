export interface StorageEntry {
  name: string;
  isDirectory: boolean;
}

export interface StorageProvider {
  upload(key: string, stream: NodeJS.ReadableStream): Promise<void>;
  download(key: string): Promise<NodeJS.ReadableStream>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  list(prefix: string): Promise<StorageEntry[]>;
  readJson<T>(key: string): Promise<T>;
  writeJson<T>(key: string, data: T): Promise<void>;
  size(key: string): Promise<number>;
  /**
   * A URL the caller can use to fetch `key` directly, valid for at least `expiresInSeconds`.
   * Local storage has no notion of expiry — it returns the server's own streaming route, which
   * exists for as long as the process does. Remote providers (e.g. Supabase) return a real
   * short-lived signed URL; callers must never persist the result, only serve it fresh per request.
   */
  getDownloadUrl(key: string, expiresInSeconds?: number): Promise<string>;
}
