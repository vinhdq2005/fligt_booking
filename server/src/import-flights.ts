import "dotenv/config";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { prisma } from "./lib/prisma";
import { getImportStatus, importFlights } from "./modules/flight-import/import.service";

async function main() {
  const [departureCode, arrivalCode, dateText] = process.argv.slice(2);
  if (!departureCode || !arrivalCode || !dateText) {
    throw new Error("Cách dùng: npx tsx src/import-flights.ts HAN SGN YYYY-MM-DD [--yes]");
  }
  const request = { departureCode, arrivalCode, dateText };
  const current = await getImportStatus(request);

  if (current.status === "fresh") {
    console.log(`Đã có dữ liệu còn hạn, search ID: ${current.latestId}. Không gọi SerpApi.`);
    return;
  }

  console.log(current.status === "expired"
    ? `Dữ liệu trước đó đã hết hạn (search ID: ${current.latestId}).`
    : "Chưa có dữ liệu cho tuyến và ngày này.");

  let confirmed = process.argv.includes("--yes");
  if (!confirmed && stdin.isTTY) {
    const input = createInterface({ input: stdin, output: stdout });
    try {
      const answer = await input.question("Gọi SerpApi và lưu dữ liệu mới? [y/N] ");
      confirmed = /^(y|yes)$/i.test(answer.trim());
    } finally {
      input.close();
    }
  }

  const result = await importFlights(request, confirmed);
  if (result.status === "confirmation_required") {
    console.log("Đã hủy; không gọi SerpApi và không ghi database.");
  } else if (result.status === "already_fresh") {
    console.log(`Đã có dữ liệu còn hạn, search ID: ${result.searchId}.`);
  } else {
    console.log(`Đã lưu search ID ${result.searchId} với ${result.offerCount} lựa chọn chuyến bay.`);
  }
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
