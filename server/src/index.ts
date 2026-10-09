import "dotenv/config";
import { createApp } from "./app";
import { getImportStatus, importFlights } from "./modules/flight-import/import.service";
import { listFlights } from "./modules/flights/flight-list.service";

const adminToken = process.env.ADMIN_API_TOKEN;
if (!adminToken) throw new Error("Thiếu ADMIN_API_TOKEN trong server/.env");

const port = Number(process.env.PORT ?? 3001);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("PORT không hợp lệ");
}

const app = createApp(adminToken, { getImportStatus, importFlights }, { listFlights });
app.listen(port, "127.0.0.1", () => {
  console.log(`Admin API đang chạy tại http://127.0.0.1:${port}`);
});
