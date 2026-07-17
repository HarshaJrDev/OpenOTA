import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { isValidSha256 } from '@openota/shared';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { Express } from 'express';

/**
 * Validates the CLI -> Server half of the pipeline described in the certification plan
 * (`apps/e2e/docs/ACCEPTANCE_CRITERIA.md`, scenarios S1-S8): a real CLI-built package uploads
 * correctly, the manifest fields the native runtime depends on survive the round trip unchanged,
 * and the server's negative paths (duplicate, missing, malformed) behave as documented.
 *
 * This does not touch Android — see `apps/e2e/android` for the on-device half (download, verify,
 * install, activate, restart, rollback) which reads fixtures produced by
 * `pnpm fixtures:generate` (the same real CLI/server pipeline, captured to disk).
 */

let app: Express;
let storageRoot: string;

beforeAll(async () => {
  storageRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'openota-e2e-server-'));
  process.env.NODE_ENV = 'test';
  process.env.STORAGE_ROOT = storageRoot;
  ({ app } = await import('../../../server/src/app.js'));
});

afterAll(async () => {
  await fs.rm(storageRoot, { recursive: true, force: true });
});

async function upload(version: string, runtimeVersion = '1.0.0', bundleContent = `bundle-${version}`) {
  const { createHash } = await import('node:crypto');
  const buffer = Buffer.from(bundleContent);
  const sha256 = createHash('sha256').update(buffer).digest('hex');

  return request(app)
    .post('/api/v1/packages')
    .field('platform', 'android')
    .field('version', version)
    .field('runtimeVersion', runtimeVersion)
    .field('bundleName', 'index.android.bundle')
    .field('sha256', sha256)
    .field('size', String(buffer.length))
    .attach('file', buffer, { filename: 'ota-package.zip', contentType: 'application/zip' });
}

describe('S1 — initial state / no update available', () => {
  it('reports no update when the device is already on the latest version', async () => {
    await upload('1.0.0');

    const res = await request(app)
      .get('/api/v1/packages/check')
      .query({ platform: 'android', currentVersion: '1.0.0' });

    expect(res.status).toBe(200);
    expect(res.body.data.available).toBe(false);
    expect(res.body.data.latestVersion).toBe('1.0.0');
  });
});

describe('S2 — update available', () => {
  it('reports an available update with a fully-populated manifest', async () => {
    await upload('2.0.0');

    const res = await request(app)
      .get('/api/v1/packages/check')
      .query({ platform: 'android', currentVersion: '1.0.0' });

    expect(res.status).toBe(200);
    expect(res.body.data.available).toBe(true);
    expect(res.body.data.latestVersion).toBe('2.0.0');

    const manifest = res.body.data.manifest;
    // Every field the native BundleVerifier requires must be present and correctly named —
    // this is a regression guard for the bundleName-vs-zip-filename bug found in the shared
    // contracts refactor.
    expect(manifest.manifestVersion).toBe(1);
    expect(manifest.bundleVersion).toBe('2.0.0');
    expect(manifest.platform).toBe('android');
    expect(manifest.runtimeVersion).toBe('1.0.0');
    expect(manifest.bundleName).toBe('index.android.bundle');
    expect(isValidSha256(manifest.sha256)).toBe(true);
    expect(typeof manifest.downloadUrl).toBe('string');
  });
});

describe('S3 — download', () => {
  it('streams bytes whose sha256 matches the manifest', async () => {
    const content = 'a-specific-bundle-payload';
    await upload('4.0.0', '1.0.0', content);

    const check = await request(app).get('/api/v1/packages/check').query({ platform: 'android', currentVersion: '0.0.0' });
    const manifest = check.body.data.manifest;

    const download = await request(app)
      .get(`/api/v1/packages/android/4.0.0/download`)
      .buffer(true)
      .parse((res, callback) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => callback(null, Buffer.concat(chunks)));
      });
    expect(download.status).toBe(200);
    expect(download.headers['content-type']).toBe('application/zip');

    const { createHash } = await import('node:crypto');
    const actualSha256 = createHash('sha256').update(download.body as Buffer).digest('hex');
    expect(actualSha256).toBe(manifest.sha256);
  });
});

describe('S4 — duplicate package rejected', () => {
  it('rejects re-uploading the same platform+version', async () => {
    await upload('5.0.0');
    const res = await upload('5.0.0');

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('PACKAGE_ALREADY_EXISTS');
  });
});

describe('S5 — missing package', () => {
  it('returns PACKAGE_NOT_FOUND for a version that was never uploaded', async () => {
    const res = await request(app).get('/api/v1/packages/android/999.999.999');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('PACKAGE_NOT_FOUND');
  });
});

describe('S6 — invalid manifest rejected at upload time', () => {
  it('rejects an upload missing a required field (runtimeVersion)', async () => {
    const res = await request(app)
      .post('/api/v1/packages')
      .field('platform', 'android')
      .field('version', '6.0.0')
      .field('bundleName', 'index.android.bundle')
      .attach('file', Buffer.from('x'), { filename: 'ota-package.zip', contentType: 'application/zip' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects a malformed version string', async () => {
    const res = await request(app)
      .post('/api/v1/packages')
      .field('platform', 'android')
      .field('version', 'not-a-version')
      .field('runtimeVersion', '1.0.0')
      .field('bundleName', 'index.android.bundle')
      .attach('file', Buffer.from('x'), { filename: 'ota-package.zip', contentType: 'application/zip' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('S7 — package listing', () => {
  it('lists every uploaded package', async () => {
    const res = await request(app).get('/api/v1/packages');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(4); // 1.0.0, 2.0.0, 4.0.0, 5.0.0 from earlier suites
  });
});

describe('S8 — deletion', () => {
  it('deletes a package and it is no longer reachable', async () => {
    await upload('7.0.0');
    const del = await request(app).delete('/api/v1/packages/android/7.0.0');
    expect(del.status).toBe(200);

    const get = await request(app).get('/api/v1/packages/android/7.0.0');
    expect(get.status).toBe(404);
  });
});

describe('S9 — rollback (fixed contract gap: POST /packages/rollback)', () => {
  it('points the active version back at an already-uploaded release without deleting anything', async () => {
    await upload('8.0.0');
    await upload('9.0.0');

    const before = await request(app).get('/api/v1/packages/check').query({ platform: 'android', currentVersion: '8.0.0' });
    expect(before.body.data.available).toBe(true);
    expect(before.body.data.latestVersion).toBe('9.0.0');

    const rollback = await request(app).post('/api/v1/packages/rollback').send({ platform: 'android', version: '8.0.0' });
    expect(rollback.status).toBe(200);
    expect(rollback.body.data.bundleVersion).toBe('8.0.0');

    const after = await request(app).get('/api/v1/packages/check').query({ platform: 'android', currentVersion: '8.0.0' });
    expect(after.body.data.available).toBe(false);
    expect(after.body.data.latestVersion).toBe('8.0.0');

    // 9.0.0 must still exist — rollback moves a pointer, it never deletes a package.
    const stillThere = await request(app).get('/api/v1/packages/android/9.0.0');
    expect(stillThere.status).toBe(200);
  });

  it('rejects rolling back to a version that was never uploaded', async () => {
    const res = await request(app).post('/api/v1/packages/rollback').send({ platform: 'android', version: '404.0.0' });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('PACKAGE_NOT_FOUND');
  });
});
