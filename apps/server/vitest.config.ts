import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: false,
    include: ["src/**/*.test.ts"],
    // Several test files mutate global process.env (STORAGE_ROOT, STORAGE_PROVIDER,
    // OPENOTA_MAX_PACKAGE_SIZE_MB, ...) to exercise config-dependent behavior before dynamically
    // importing app.js. That's only safe if test files never share a worker concurrently.
    fileParallelism: false,
  },
});
