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
}
