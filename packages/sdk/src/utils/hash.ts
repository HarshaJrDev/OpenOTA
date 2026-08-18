import { Platform } from "react-native";
import QuickCrypto from "react-native-quick-crypto";
import RNFS from "react-native-fs";

const CHUNK_SIZE_BYTES = 1024 * 1024; // 1 MB

export async function computeSha256(filePath: string): Promise<string> {
  const hash = QuickCrypto.createHash("sha256");

  // RNFS.read()'s length/position args fail to bridge to iOS's NSInteger under the New
  // Architecture (Fabric/Bridgeless) — "Error while converting JavaScript argument 1 to
  // Objective C type NSInteger" — which broke every OTA sync/check on iOS running on the New
  // Architecture. RNFS.readFile() takes no numeric args, sidestepping that bridging bug
  // entirely. OTA bundles are small enough that reading the whole file at once is fine.
  if (Platform.OS === "ios") {
    const base64Content = await RNFS.readFile(filePath, "base64");
    hash.update(base64Content, "base64");
    return hash.digest("hex") as string;
  }

  const stat = await RNFS.stat(filePath);
  const totalSize = Number(stat.size);

  let position = 0;

  while (position < totalSize) {
    const length = Math.min(CHUNK_SIZE_BYTES, totalSize - position);
    const base64Chunk = await RNFS.read(filePath, length, position, "base64");
    hash.update(base64Chunk, "base64");
    position += length;
  }

  return hash.digest("hex") as string;
}
