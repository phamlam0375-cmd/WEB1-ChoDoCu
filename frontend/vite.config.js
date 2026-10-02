import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // Chuyển /api sang backend khi chạy `pnpm dev`.
    proxy: {
      "/api": "http://localhost:3000",
    },
  },
});
