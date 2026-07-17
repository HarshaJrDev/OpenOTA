import { Platform } from 'react-native';

/**
 * Android emulators reach the host machine's `localhost` at `10.0.2.2`; iOS simulators can use
 * `localhost` directly. Override with a real host when testing against a physical device or a
 * deployed server — see Settings for the in-app override.
 */
const DEFAULT_HOST = Platform.OS === 'android' ? '10.0.2.2' : 'localhost';

export const PLAYGROUND_CONFIG = {
  serverUrl: `http://${DEFAULT_HOST}:3900/api/v1`,
  channel: 'production',
  autoRestart: false,
  requestTimeout: 15_000,
  embeddedBundleVersion: '1.0.0',
};
