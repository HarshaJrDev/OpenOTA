import QuickCrypto from "react-native-quick-crypto";
import RNFS from "react-native-fs";

const CHUNK_SIZE_BYTES = 1024 * 1024; // 1 MB

export async function computeSha256(filePath: string): Promise<string> {
  const stat = await RNFS.stat(filePath);
  const totalSize = Number(stat.size);
  const hash = QuickCrypto.createHash("sha256");

  let position = 0;

  while (position < totalSize) {
    const length = Math.min(CHUNK_SIZE_BYTES, totalSize - position);
    const base64Chunk = await RNFS.read(filePath, length, position, "base64");
    hash.update(base64Chunk, "base64");
    position += length;
  }

  return hash.digest("hex") as string;
}
