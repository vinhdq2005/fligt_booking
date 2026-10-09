import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

export default defineConfig(({ mode }) => {
  // Chỉ dùng trong Vite dev server. Token không được đưa vào bundle của trình duyệt.
  const serverDir = fileURLToPath(new URL("../server/", import.meta.url));
  const serverEnv = loadEnv(mode, serverDir, "");
  const adminToken = process.env.ADMIN_API_TOKEN || serverEnv.ADMIN_API_TOKEN || "";
  return {
    plugins: [react()],
    server: {
      host: "127.0.0.1",
      proxy: {
        "/api": {
          target: `http://127.0.0.1:${serverEnv.PORT || "3001"}`,
          changeOrigin: true,
          headers: {
            authorization: `Bearer ${adminToken}`,
          },
        },
      },
    },
  };
});
