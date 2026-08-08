module.exports = {
  preset: '@react-native/jest-preset',
  setupFiles: ['./jest.setup.js'],
  // @openota/sdk and @openota/shared ship pure ESM (`type: "module"`, no CJS build) — Jest's
  // default transformIgnorePatterns skips all of node_modules, so without this override importing
  // them fails on the bare `export` syntax before Babel ever sees it.
  transformIgnorePatterns: [
    'node_modules/(?!(@react-native|react-native|@react-navigation|react-native-.*|@openota)/)',
  ],
};
