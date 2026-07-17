import path from 'node:path';

import fse from 'fs-extra';

/**
 * Builds a minimal fake React Native project on disk that satisfies everything the real CLI's
 * `build` command touches (package.json version, a `react-native` binary shim that behaves like
 * `react-native bundle`, an entry file) — without needing an actual RN toolchain installed. This
 * is the same trick used for manual smoke testing throughout development; codifying it here is
 * what lets the e2e suite produce REAL CLI output instead of hand-typed JSON fixtures.
 */
export async function createFakeRnProject(root: string, appVersion: string): Promise<void> {
  await fse.ensureDir(root);
  await fse.writeJson(path.join(root, 'package.json'), {
    name: 'e2e-fake-rn-app',
    version: appVersion,
    dependencies: { 'react-native': '0.82.0' },
  });

  await fse.ensureDir(path.join(root, 'node_modules', 'react-native'));
  await fse.writeJson(path.join(root, 'node_modules', 'react-native', 'package.json'), {
    version: '0.82.0',
  });

  await fse.writeFile(path.join(root, 'index.js'), "console.log('entry');\n");

  const binDir = path.join(root, 'node_modules', '.bin');
  await fse.ensureDir(binDir);
  const shimPath = path.join(binDir, 'react-native');
  await fse.writeFile(
    shimPath,
    `#!/usr/bin/env node
const args = process.argv.slice(2);
const fs = require('fs');
const path = require('path');
if (args[0] === '--version') { console.log('0.82.0'); process.exit(0); }
if (args[0] === 'bundle') {
  const get = (flag) => args[args.indexOf(flag) + 1];
  const bundleOutput = get('--bundle-output');
  const assetsDest = get('--assets-dest');
  fs.mkdirSync(path.dirname(bundleOutput), { recursive: true });
  fs.writeFileSync(bundleOutput, '// e2e fixture bundle v${appVersion} @ ' + Date.now() + '\\n');
  fs.mkdirSync(assetsDest, { recursive: true });
  fs.writeFileSync(path.join(assetsDest, 'logo.png'), 'fake-asset-bytes');
  process.exit(0);
}
process.exit(1);
`,
  );
  await fse.chmod(shimPath, 0o755);
}
