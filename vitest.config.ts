import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  test: {
    include: ["packages/*/test/**/*.test.ts"],
    environment: "node",
  },
  resolve: {
    alias: {
      // Test against source, not against a build artifact. tsc project
      // references handle the real dependency at build time.
      "@michi/core": fileURLToPath(new URL("./packages/core/src/index.ts", import.meta.url)),
      "@michi/adapters": fileURLToPath(new URL("./packages/adapters/src/index.ts", import.meta.url)),
    },
  },
});
