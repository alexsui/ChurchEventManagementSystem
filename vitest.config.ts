import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    // Service/library tests should run in Node by default.
    // React/component tests can opt into jsdom via file-level directive.
    environment: "node",
    exclude: ["e2e/**", "node_modules/**", ".worktrees/**", "**/*.integration.test.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
