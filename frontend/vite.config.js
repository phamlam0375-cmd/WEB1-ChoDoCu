import { defineConfig, loadEnv } from "vite";
import process from "node:process";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_API_PROXY_TARGET");
  return {
    plugins: [react(), tailwindcss()],
    server: {
      // Override chỉ trong cấu hình dev cá nhân; không đổi URL production.
      proxy: {
        "/api": env.VITE_API_PROXY_TARGET || "http://localhost:3000",
      },
    },
  };
});
