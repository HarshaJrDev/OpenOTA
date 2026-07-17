import path from 'node:path';

import AdmZip from 'adm-zip';
import fse from 'fs-extra';

import { createFakeRnProject } from './fake-rn-project.js';
import { runOpenOtaCli } from './run-cli.js';
import { startRealServer } from './server-harness.js';

const REPO_ROOT = path.resolve(new URL('.', import.meta.url).pathname, '..', '..', '..');
const E2E_ROOT = path.join(REPO_ROOT, 'apps', 'e2e');
const WORKDIR = path.join(REPO_ROOT, '.e2e-work');
const FIXTURES_OUT = path.join(E2E_ROOT, 'android', 'src', 'androidTest', 'assets', 'fixtures');

const APP_VERSION = '1.0.0';
const RUNTIME_VERSION = APP_VERSION;
const UPDATE_VERSION = '2.0.0';
const SERVER_PORT = 4790;

async function extractZip(zipPath: string, destDir: string): Promise<void> {
  await fse.ensureDir(destDir);
  new AdmZip(zipPath).extractAllTo(destDir, true);
}

async function copyDir(src: string, dest: string): Promise<void> {
  await fse.ensureDir(path.dirname(dest));
  await fse.copy(src, dest);
}

/**
 * Produces every fixture the Android instrumented suite (`apps/e2e/android`) reads, all derived
 * from ONE real package built and uploaded through the REAL CLI and REAL server — not hand-typed
 * JSON. Negative fixtures are produced by deterministically tampering with that real package, so
 * every field except the one under test is guaranteed authentic CLI/server output.
 */
async function main(): Promise<void> {
  await fse.remove(WORKDIR);
  await fse.remove(FIXTURES_OUT);
  await fse.ensureDir(WORKDIR);
  await fse.ensureDir(FIXTURES_OUT);

  const projectDir = path.join(WORKDIR, 'fake-rn-app');
  await createFakeRnProject(projectDir, APP_VERSION);

  console.log('[e2e] starting real @openota/server...');
  const storageRoot = path.join(WORKDIR, 'server-storage');
  const server = await startRealServer(storageRoot, SERVER_PORT);

  console.log('[e2e] openota init');
  await runOpenOtaCli(projectDir, ['init', '--server-url', server.baseUrl]);

  console.log('[e2e] openota release (v' + UPDATE_VERSION + ')');
  await runOpenOtaCli(projectDir, ['release', '--version', UPDATE_VERSION, '--platform', 'android']);

  const outputDir = path.join(projectDir, 'openota', 'android', UPDATE_VERSION);
  const zipPath = path.join(outputDir, 'ota-package.zip');
  const manifestPath = path.join(outputDir, 'manifest.json');

  if (!(await fse.pathExists(zipPath))) throw new Error(`Expected CLI to produce ${zipPath}`);

  const manifest = await fse.readJson(manifestPath);
  console.log('[e2e] real manifest:', manifest);

  // ---- valid: the real, untampered, CLI-built + server-verified package, extracted -----------
  const validDir = path.join(FIXTURES_OUT, 'valid');
  await extractZip(zipPath, validDir);
  console.log('[e2e] wrote fixture: valid/');

  // ---- wrong-runtime-version: manifest.runtimeVersion no longer matches the app's ------------
  const wrongRuntimeDir = path.join(FIXTURES_OUT, 'wrong-runtime-version');
  await copyDir(validDir, wrongRuntimeDir);
  await mutateManifest(wrongRuntimeDir, (m) => ({ ...m, runtimeVersion: '999.0.0' }));
  console.log('[e2e] wrote fixture: wrong-runtime-version/');

  // ---- wrong-platform: manifest.platform no longer "android" ----------------------------------
  const wrongPlatformDir = path.join(FIXTURES_OUT, 'wrong-platform');
  await copyDir(validDir, wrongPlatformDir);
  await mutateManifest(wrongPlatformDir, (m) => ({ ...m, platform: 'ios' }));
  console.log('[e2e] wrote fixture: wrong-platform/');

  // ---- invalid-sha: manifest.sha256 no longer matches the real bundle file --------------------
  const invalidShaDir = path.join(FIXTURES_OUT, 'invalid-sha');
  await copyDir(validDir, invalidShaDir);
  await mutateManifest(invalidShaDir, (m) => ({ ...m, sha256: 'f'.repeat(64) }));
  console.log('[e2e] wrote fixture: invalid-sha/');

  // ---- corrupt-bundle: the real manifest's sha256 kept, but bundle bytes flipped afterwards ---
  // (equivalent failure mode to invalid-sha from the verifier's point of view, but demonstrates
  // that ANY divergence between bytes-on-disk and the manifest is caught, not just a bad manifest)
  const corruptBundleDir = path.join(FIXTURES_OUT, 'corrupt-bundle');
  await copyDir(validDir, corruptBundleDir);
  const corruptBundleFile = path.join(corruptBundleDir, 'bundle', manifest.bundleName);
  const original = await fse.readFile(corruptBundleFile);
  const corrupted = Buffer.from(original);
  corrupted[0] = (corrupted[0] ?? 0) ^ 0xff;
  await fse.writeFile(corruptBundleFile, corrupted);
  console.log('[e2e] wrote fixture: corrupt-bundle/');

  // ---- invalid-manifest: required field missing entirely --------------------------------------
  const invalidManifestDir = path.join(FIXTURES_OUT, 'invalid-manifest');
  await copyDir(validDir, invalidManifestDir);
  await fse.writeJson(path.join(invalidManifestDir, 'manifest.json'), { version: manifest.version }, { spaces: 2 });
  console.log('[e2e] wrote fixture: invalid-manifest/');

  // ---- missing-manifest: manifest.json absent entirely -----------------------------------------
  const missingManifestDir = path.join(FIXTURES_OUT, 'missing-manifest');
  await copyDir(validDir, missingManifestDir);
  await fse.remove(path.join(missingManifestDir, 'manifest.json'));
  console.log('[e2e] wrote fixture: missing-manifest/');

  // ---- missing-bundle: bundle/ directory absent -------------------------------------------------
  const missingBundleDir = path.join(FIXTURES_OUT, 'missing-bundle');
  await copyDir(validDir, missingBundleDir);
  await fse.remove(path.join(missingBundleDir, 'bundle'));
  console.log('[e2e] wrote fixture: missing-bundle/');

  // ---- missing-assets: assets/ directory absent -------------------------------------------------
  const missingAssetsDir = path.join(FIXTURES_OUT, 'missing-assets');
  await copyDir(validDir, missingAssetsDir);
  await fse.remove(path.join(missingAssetsDir, 'assets'));
  console.log('[e2e] wrote fixture: missing-assets/');

  // ---- second valid generation (v3.0.0), used for the "bundle switching" / "rollback" tests ---
  console.log('[e2e] openota release (v3.0.0) — second generation for rollback/switching tests');
  await runOpenOtaCli(projectDir, ['release', '--version', '3.0.0', '--platform', 'android']);
  const secondOutputDir = path.join(projectDir, 'openota', 'android', '3.0.0');
  const secondValidDir = path.join(FIXTURES_OUT, 'valid-v3');
  await extractZip(path.join(secondOutputDir, 'ota-package.zip'), secondValidDir);
  console.log('[e2e] wrote fixture: valid-v3/');

  await server.close();

  // Persist real manifest values the Android tests assert against, so assertions are driven by
  // what the CLI/server actually produced, not values re-typed by hand.
  await fse.writeJson(
    path.join(FIXTURES_OUT, 'expected.json'),
    {
      appVersion: APP_VERSION,
      runtimeVersion: RUNTIME_VERSION,
      updateVersion: UPDATE_VERSION,
      manifestVersion: manifest.manifestVersion,
      bundleName: manifest.bundleName,
      sha256: manifest.sha256,
    },
    { spaces: 2 },
  );

  console.log('[e2e] fixtures written to', FIXTURES_OUT);
}

async function mutateManifest(dir: string, mutate: (manifest: Record<string, unknown>) => Record<string, unknown>): Promise<void> {
  const manifestPath = path.join(dir, 'manifest.json');
  const manifest = await fse.readJson(manifestPath);
  await fse.writeJson(manifestPath, mutate(manifest), { spaces: 2 });
}

main().catch((error) => {
  console.error('[e2e] fixture generation failed:', error);
  process.exitCode = 1;
});
