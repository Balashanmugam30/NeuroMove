import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.{ts,tsx}"],
    watch: false,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./"),
      "@neuromove/contracts": path.resolve(
        __dirname,
        "../../packages/contracts/src",
      ),
      "@neuromove/ui": path.resolve(__dirname, "../../packages/ui/src"),
    },
  },
});
