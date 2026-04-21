import { defineConfig } from "vitest/config";
import netlify from "@netlify/vite-plugin";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react(), netlify()],
  test: {
    environment: "jsdom",
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "**/e2e/**",
      "**/.claude/**",
      "**/.codex/**",
    ],
  },
});
