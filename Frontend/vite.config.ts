import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  // Use the same origin as Backend/.env DASHBOARD_URL_LOCAL for cookies and CORS.
  const proxy = {
    "/api": {
      target: env.API_PROXY_TARGET || "http://127.0.0.1:3000",
      changeOrigin: true,
    },
  };
  return {
    plugins: [react(), tailwindcss()],
    server: { host: "localhost", port: 5173, strictPort: true, proxy },
    preview: { host: "localhost", port: 5173, strictPort: true, proxy },
  };
});
