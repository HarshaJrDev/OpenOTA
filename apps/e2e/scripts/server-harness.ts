import path from 'node:path';
import type { Server } from 'node:http';

export interface ServerHandle {
  baseUrl: string;
  storageRoot: string;
  close: () => Promise<void>;
}

/**
 * Boots the REAL `@openota/server` Express app in-process against an isolated storage directory.
 * Env vars must be set before the app module is imported — `apps/server`'s `config/env.ts` parses
 * `process.env` once, at import time.
 */
export async function startRealServer(storageRoot: string, port: number): Promise<ServerHandle> {
  process.env.NODE_ENV = 'test';
  process.env.STORAGE_ROOT = storageRoot;
  process.env.PORT = String(port);

  const serverEntry = path.resolve(
    new URL('.', import.meta.url).pathname,
    '..',
    '..',
    '..',
    'apps',
    'server',
    'src',
    'app.js',
  );

  // tsx resolves the .ts source for this relative specifier at runtime.
  const { app } = (await import(serverEntry.replace(/\.js$/, '.ts'))) as { app: import('express').Express };

  const httpServer: Server = await new Promise((resolve) => {
    const s = app.listen(port, () => resolve(s));
  });

  return {
    baseUrl: `http://localhost:${port}/api/v1`,
    storageRoot,
    close: () =>
      new Promise<void>((resolve, reject) => {
        httpServer.close((error) => (error ? reject(error) : resolve()));
      }),
  };
}
