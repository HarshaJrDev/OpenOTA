// @openota/sdk's native peer deps (file download, zip extraction, key-value storage, crypto) are
// real native modules on-device — stubbed here only so this smoke test's module graph can load
// without a device/simulator attached.
jest.mock("react-native-fs", () => ({
  DocumentDirectoryPath: "/mock/documents",
  CachesDirectoryPath: "/mock/caches",
  exists: jest.fn().mockResolvedValue(false),
  mkdir: jest.fn().mockResolvedValue(undefined),
  unlink: jest.fn().mockResolvedValue(undefined),
  downloadFile: jest.fn(),
  readDir: jest.fn().mockResolvedValue([]),
}));
jest.mock("react-native-zip-archive", () => ({ unzip: jest.fn().mockResolvedValue("/mock/extracted") }));
jest.mock("react-native-mmkv", () => ({
  MMKV: jest.fn().mockImplementation(() => ({
    getString: jest.fn(),
    set: jest.fn(),
    delete: jest.fn(),
    contains: jest.fn().mockReturnValue(false),
  })),
}));
jest.mock("react-native-quick-crypto", () => ({ createHash: jest.fn() }));
jest.mock("react-native-quick-base64", () => ({}));
