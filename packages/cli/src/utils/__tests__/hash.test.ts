import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { computeSha256 } from "../hash.js";

let dir: string;

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), "openota-hash-test-"));
});

afterEach(async () => {
  await fs.rm(dir, { recursive: true, force: true });
});

describe("computeSha256", () => {
  it("matches the expected digest for known content", async () => {
    const filePath = path.join(dir, "sample.bin");
    const content = Buffer.from("hello openota");
    await fs.writeFile(filePath, content);

    const expected = createHash("sha256").update(content).digest("hex");
    const actual = await computeSha256(filePath);

    expect(actual).toBe(expected);
  });
});
