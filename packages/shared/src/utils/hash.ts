const SHA256_HEX_PATTERN = /^[a-f0-9]{64}$/i;

export function isValidSha256(value: string): boolean {
  return SHA256_HEX_PATTERN.test(value);
}

/**
 * Streaming SHA-256 computation is deliberately NOT here: the server and CLI use Node's
 * `crypto`+`fs`, while the SDK uses `react-native-quick-crypto`+`react-native-fs` — two genuinely
 * different I/O primitives with no common abstraction that wouldn't force one platform through the
 * other's runtime. Unifying that would either drag Node's `crypto` into a React Native bundle or an
 * RN-only library into the server. Each package keeps its own `computeSha256`; this file only holds
 * the one thing that IS portable: validating that a string looks like a SHA-256 hex digest.
 */
