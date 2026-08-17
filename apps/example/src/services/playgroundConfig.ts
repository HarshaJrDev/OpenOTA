/**
 * Points at the real deployed OpenOTA Cloud backend by default, matching this app's own
 * openota.config.json, so the playground demonstrates the actual production pipeline rather than
 * a local-only loop. Override in Settings for local dev — Android emulators reach the host
 * machine's `localhost` at `10.0.2.2`; iOS simulators can use `localhost` directly.
 */
export const PLAYGROUND_CONFIG = {
  serverUrl: 'https://api.openota.xyz/api/v1',
  projectId: 'b9f60c94-7599-4f5f-b4c7-75fcc6d3351e',
  channel: 'production',
  autoRestart: false,
  requestTimeout: 15_000,
  embeddedBundleVersion: '1.0.0',
};
