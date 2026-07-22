import { Readable } from "node:stream";

import { beforeEach, describe, expect, it, vi } from "vitest";

const uploadMock = vi.fn();
const downloadMock = vi.fn();
const removeMock = vi.fn();
const listMock = vi.fn();
const createSignedUrlMock = vi.fn();

const fromMock = vi.fn(() => ({
  upload: uploadMock,
  download: downloadMock,
  remove: removeMock,
  list: listMock,
  createSignedUrl: createSignedUrlMock,
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    storage: { from: fromMock },
  })),
}));

const { createSupabaseStorageProvider } = await import("../supabase.provider.js");

const config = { url: "https://example.supabase.co", serviceRoleKey: "service-role-secret", bucket: "openota-releases" };

beforeEach(() => {
  uploadMock.mockReset();
  downloadMock.mockReset();
  removeMock.mockReset();
  listMock.mockReset();
  createSignedUrlMock.mockReset();
});

describe("SupabaseStorageProvider", () => {
  it("uploads a stream as a buffer", async () => {
    uploadMock.mockResolvedValue({ error: null });
    const storage = createSupabaseStorageProvider(config);

    await storage.upload("android/1.0.0/ota-package.zip", Readable.from(Buffer.from("hello")));

    expect(uploadMock).toHaveBeenCalledWith(
      "android/1.0.0/ota-package.zip",
      expect.any(Buffer),
      expect.objectContaining({ upsert: true }),
    );
  });

  it("translates an upload error into a StorageError without leaking Supabase internals", async () => {
    uploadMock.mockResolvedValue({ error: { message: "some internal supabase detail" } });
    const storage = createSupabaseStorageProvider(config);

    await expect(
      storage.upload("android/1.0.0/ota-package.zip", Readable.from(Buffer.from("x"))),
    ).rejects.toThrow(/Failed to upload/);
  });

  it("generates a signed URL with the requested expiry", async () => {
    createSignedUrlMock.mockResolvedValue({ data: { signedUrl: "https://signed.example/x" }, error: null });
    const storage = createSupabaseStorageProvider(config);

    const url = await storage.getDownloadUrl("android/1.0.0/ota-package.zip", 120);

    expect(url).toBe("https://signed.example/x");
    expect(createSignedUrlMock).toHaveBeenCalledWith("android/1.0.0/ota-package.zip", 120);
  });

  it("translates a signed URL failure into a StorageError", async () => {
    createSignedUrlMock.mockResolvedValue({ data: null, error: { message: "object not found" } });
    const storage = createSupabaseStorageProvider(config);

    await expect(storage.getDownloadUrl("android/9.9.9/ota-package.zip")).rejects.toThrow();
  });

  it("reports exists() by listing the parent prefix and matching the filename", async () => {
    listMock.mockResolvedValue({ data: [{ name: "ota-package.zip", metadata: { size: 10 } }], error: null });
    const storage = createSupabaseStorageProvider(config);

    expect(await storage.exists("android/1.0.0/ota-package.zip")).toBe(true);
    expect(listMock).toHaveBeenCalledWith("android/1.0.0", { search: "ota-package.zip" });
  });

  it("reports exists() false when the object is absent", async () => {
    listMock.mockResolvedValue({ data: [], error: null });
    const storage = createSupabaseStorageProvider(config);

    expect(await storage.exists("android/9.9.9/ota-package.zip")).toBe(false);
  });

  it("deletes an object", async () => {
    removeMock.mockResolvedValue({ error: null });
    const storage = createSupabaseStorageProvider(config);

    await storage.delete("android/1.0.0/ota-package.zip");
    expect(removeMock).toHaveBeenCalledWith(["android/1.0.0/ota-package.zip"]);
  });

  it("reads size() from list() metadata", async () => {
    listMock.mockResolvedValue({ data: [{ name: "ota-package.zip", metadata: { size: 895873 } }], error: null });
    const storage = createSupabaseStorageProvider(config);

    expect(await storage.size("android/1.0.0/ota-package.zip")).toBe(895873);
  });
});
