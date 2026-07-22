/**
 * Points at the real deployed OpenOTA backend (Render + Supabase Storage) by default, matching
 * this app's own openota.config.json, so the playground demonstrates the actual production
 * pipeline rather than a local-only loop. Override in Settings for local dev — Android emulators
 * reach the host machine's `localhost` at `10.0.2.2`; iOS simulators can use `localhost` directly.
 */
export const PLAYGROUND_CONFIG = {
  serverUrl: 'https://openota.onrender.com/api/v1',
  channel: 'production',
  autoRestart: false,
  requestTimeout: 15_000,
  embeddedBundleVersion: '1.0.0',
};
