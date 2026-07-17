/**
 * A release channel is an opaque, server-defined label (e.g. "production", "beta", "staging").
 * Deliberately not a closed union — channels are configured per deployment, not fixed by the SDK.
 */
export type Channel = string;

export const DEFAULT_CHANNEL: Channel = "production";
