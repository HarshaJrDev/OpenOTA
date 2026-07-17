const path = require('path');
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

const workspaceRoot = path.resolve(__dirname, '../..');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const config = {
  // Symlinked workspace packages (@openota/*, and every hoisted dependency in the pnpm store)
  // physically live outside this app's own directory tree — Metro only watches/crawls
  // `projectRoot` by default, so the pnpm store has to be an explicit watch folder or none of
  // those symlink targets are visible to it.
  watchFolders: [workspaceRoot],
  resolver: {
    // This is a pnpm workspace — most packages under node_modules (including @openota/* and
    // @babel/runtime) are symlinks into the shared pnpm store, which Metro doesn't follow by
    // default.
    unstable_enableSymlinks: true,
    // Metro 0.84's default package-exports resolution can't resolve @babel/runtime's helper
    // subpaths (its exports map uses an array-of-conditions form Metro's resolver rejects),
    // breaking every production (--dev false) bundle. Disabling it falls back to plain
    // filesystem resolution, which finds the same files directly.
    unstable_enablePackageExports: false,
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
