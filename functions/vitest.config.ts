import { defineConfig } from "vitest/config";

const runEmulator = process.env.FIREBASE_EMULATOR === "1";

export default defineConfig({
  test: {
    include: runEmulator
      ? ["test/emulator/**/*.test.ts"]
      : ["test/**/*.test.ts"],
    exclude: runEmulator ? [] : ["test/emulator/**"],
    testTimeout: runEmulator ? 30_000 : 5_000
  }
});
