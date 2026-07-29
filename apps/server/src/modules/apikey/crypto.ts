import { createHash, randomBytes } from "node:crypto";

const KEY_PREFIX = "ota_live_";
const BASE62_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const RANDOM_BYTE_LENGTH = 24; // 192 bits of entropy

function toBase62(bytes: Buffer): string {
  let value = BigInt(`0x${bytes.toString("hex")}`);
  if (value === 0n) {
    return "0";
  }

  let result = "";
  const base = BigInt(BASE62_ALPHABET.length);
  while (value > 0n) {
    result = BASE62_ALPHABET[Number(value % base)] + result;
    value /= base;
  }
  return result;
}

/** Full key is returned to the caller exactly once — never persisted, never logged. */
export function generateApiKey(): { fullKey: string; prefix: string; hashedKey: string } {
  const token = toBase62(randomBytes(RANDOM_BYTE_LENGTH));
  const fullKey = `${KEY_PREFIX}${token}`;
  return { fullKey, prefix: fullKey.slice(0, KEY_PREFIX.length + 8), hashedKey: hashApiKey(fullKey) };
}

export function hashApiKey(fullKey: string): string {
  return createHash("sha256").update(fullKey).digest("hex");
}

export function isProjectApiKey(presented: string): boolean {
  return presented.startsWith(KEY_PREFIX);
}
