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

  it("writes JSON with cacheControl disabled, so overwriting active.json is never served stale", async () => {
    // Reproduced live against the real bucket: rollback overwrites active.json in place, and
    // without this, the storage CDN kept serving the pre-rollback bytes to the very next read.
    uploadMock.mockResolvedValue({ error: null });
    const storage = createSupabaseStorageProvider(config);

    await storage.writeJson("android/active.json", { version: "3.0.0" });

    expect(uploadMock).toHaveBeenCalledWith(
      "android/active.json",
      expect.any(Buffer),
      expect.objectContaining({ upsert: true, cacheControl: "0" }),
    );
  });

  it("removes the existing object before writing JSON, so overwrites are a real create, not an upsert", async () => {
    // Reproduced live, repeatedly: upload(..., {upsert:true}) on an existing key returned success
    // but did not reliably replace the served content — rollback would report 200 while
    // checkForUpdate kept reading a stale (sometimes arbitrarily old) active version. remove()
    // before upload() forces a genuine create.
    removeMock.mockResolvedValue({ error: null });
    uploadMock.mockResolvedValue({ error: null });
    const storage = createSupabaseStorageProvider(config);

    await storage.writeJson("android/active.json", { version: "3.1.0" });

    expect(removeMock).toHaveBeenCalledWith(["android/active.json"]);
    expect(removeMock.mock.invocationCallOrder.length).toBeGreaterThan(0);
    expect(uploadMock.mock.invocationCallOrder.length).toBeGreaterThan(0);
    const [removeOrder] = removeMock.mock.invocationCallOrder;
    const [uploadOrder] = uploadMock.mock.invocationCallOrder;
    expect(removeOrder as number).toBeLessThan(uploadOrder as number);
  });

  it("still writes successfully when the key has never existed before (remove reports not-found)", async () => {
    removeMock.mockResolvedValue({ error: { message: "The resource was not found" } });
    uploadMock.mockResolvedValue({ error: null });
    const storage = createSupabaseStorageProvider(config);

    await expect(storage.writeJson("ios/active.json", { version: "1.0.0" })).resolves.not.toThrow();
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

  it("deletes a single object directly (no children under it)", async () => {
    listMock.mockResolvedValue({ data: [], error: null });
    removeMock.mockResolvedValue({ error: null });
    const storage = createSupabaseStorageProvider(config);

    await storage.delete("android/ota-package-active-pointer.json");
    expect(removeMock).toHaveBeenCalledWith(["android/ota-package-active-pointer.json"]);
  });

  it("recursively deletes every object under a package's directory prefix", async () => {
    // Reproduces the real bug: deletePackage calls delete("android/1.0.0"), a directory prefix,
    // expecting manifest.json/metadata.json/ota-package.zip to all be removed together — the same
    // way fse.remove() deletes a whole directory locally. Supabase Storage has no real
    // directories, so this only works if delete() lists and removes each child explicitly.
    listMock.mockResolvedValue({
      data: [
        { name: "manifest.json", metadata: { size: 300 } },
        { name: "metadata.json", metadata: { size: 115 } },
        { name: "ota-package.zip", metadata: { size: 895873 } },
      ],
      error: null,
    });
    removeMock.mockResolvedValue({ error: null });
    const storage = createSupabaseStorageProvider(config);

    await storage.delete("android/1.0.0");

    expect(removeMock).toHaveBeenCalledWith(["android/1.0.0/manifest.json"]);
    expect(removeMock).toHaveBeenCalledWith(["android/1.0.0/metadata.json"]);
    expect(removeMock).toHaveBeenCalledWith(["android/1.0.0/ota-package.zip"]);
  });

  it("reads size() from list() metadata", async () => {
    listMock.mockResolvedValue({ data: [{ name: "ota-package.zip", metadata: { size: 895873 } }], error: null });
    const storage = createSupabaseStorageProvider(config);

    expect(await storage.size("android/1.0.0/ota-package.zip")).toBe(895873);
  });
});
