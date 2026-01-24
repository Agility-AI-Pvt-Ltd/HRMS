import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => ({
  plugins: [react()],

  server: mode === "development"
    ? {
        port: 5173,
        hmr: true,
      }
    : undefined,

  build: {
    sourcemap: false, // optional but recommended
  },
}));
