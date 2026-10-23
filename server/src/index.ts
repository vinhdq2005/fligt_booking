import "dotenv/config";
import { createApp } from "./app";
import { getImportStatus, importFlights } from "./modules/flight-import/import.service";
import { listFlights } from "./modules/flights/flight-list.service";

const port = Number(process.env.PORT ?? 3001);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("PORT không hợp lệ");
}

const app = createApp({ getImportStatus, importFlights }, { listFlights });
app.listen(port, "0.0.0.0", () => {
  console.log(`Backend API đang chạy tại cổng ${port}`);
});
