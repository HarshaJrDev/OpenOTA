import { describe, expect, it, vi } from "vitest";

describe("createStorageProvider", () => {
  it("selects LocalStorageProvider when STORAGE_PROVIDER=local (the default)", async () => {
    vi.resetModules();
    process.env.STORAGE_PROVIDER = "local";
    process.env.STORAGE_ROOT = "/tmp/openota-factory-test";

    const localModule = await import("../local.provider.js");
    const spy = vi.spyOn(localModule, "createLocalStorageProvider");

    const { createStorageProvider } = await import("../index.js");
    createStorageProvider();

    expect(spy).toHaveBeenCalledWith("/tmp/openota-factory-test");
  });

  it("selects SupabaseStorageProvider when STORAGE_PROVIDER=supabase with full config", async () => {
    vi.resetModules();
    process.env.STORAGE_PROVIDER = "supabase";
    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-secret";
    process.env.SUPABASE_STORAGE_BUCKET = "openota-releases";

    const supabaseModule = await import("../supabase.provider.js");
    const spy = vi.spyOn(supabaseModule, "createSupabaseStorageProvider").mockReturnValue({
      upload: vi.fn(),
      download: vi.fn(),
      delete: vi.fn(),
      exists: vi.fn(),
      list: vi.fn(),
      readJson: vi.fn(),
      writeJson: vi.fn(),
      size: vi.fn(),
      getDownloadUrl: vi.fn(),
    });

    const { createStorageProvider } = await import("../index.js");
    createStorageProvider();

    expect(spy).toHaveBeenCalledWith({
      url: "https://example.supabase.co",
      serviceRoleKey: "service-role-secret",
      bucket: "openota-releases",
    });

    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    process.env.STORAGE_PROVIDER = "local";
  });
});
