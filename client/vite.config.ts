import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const serverDir = fileURLToPath(new URL("../server/", import.meta.url));
  const serverEnv = loadEnv(mode, serverDir, "");

  return {
    plugins: [react()],
    server: {
      host: "127.0.0.1",
      proxy: {
        "/api": {
          target: `http://127.0.0.1:${serverEnv.PORT || "3001"}`,
          changeOrigin: true,
        },
      },
    },
  };
});
