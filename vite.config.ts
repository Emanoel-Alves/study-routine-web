import vue from "@vitejs/plugin-vue";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vitest/config";

export default defineConfig({
  base: process.env.VITE_BASE_PATH || "/",
  plugins: [vue(), tailwindcss()],
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.ts"],
  },
});
