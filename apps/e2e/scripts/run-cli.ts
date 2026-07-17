import { execFile } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const REPO_ROOT = path.resolve(new URL('.', import.meta.url).pathname, '..', '..', '..');
const CLI_ENTRY = path.join(REPO_ROOT, 'packages', 'cli', 'src', 'cli.ts');
const TSX_BIN = path.join(REPO_ROOT, 'node_modules', 'tsx', 'dist', 'cli.mjs');

/** Shells out to the REAL `openota` CLI (via tsx, no separate build step needed) from `cwd`. */
export async function runOpenOtaCli(cwd: string, args: string[]): Promise<{ stdout: string; stderr: string }> {
  try {
    return await execFileAsync(process.execPath, [TSX_BIN, CLI_ENTRY, ...args], { cwd });
  } catch (error) {
    const err = error as { stdout?: string; stderr?: string; message: string };
    throw new Error(`openota ${args.join(' ')} failed:\n${err.stdout ?? ''}\n${err.stderr ?? err.message}`);
  }
}
