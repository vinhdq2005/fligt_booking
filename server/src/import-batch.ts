import { execFileSync } from "node:child_process";
import { prisma } from "./lib/prisma";
import {
  routePairs,
  importStartDate,
  importEndDate,
} from "./routes-to-import";

type Task = { from: string; to: string; date: string };

async function main() {
  const routes = routePairs.flatMap(([from, to]) => [
    { from, to },
    { from: to, to: from },
  ]);

  const start = new Date(`${importStartDate}T00:00:00.000Z`);
  const end = new Date(`${importEndDate}T00:00:00.000Z`);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
    throw new Error("Khoảng ngày import không hợp lệ");
  }

  const tasks: Task[] = [];

  for (let time = start.getTime(); time <= end.getTime(); time += 86_400_000) {
    const date = new Date(time).toISOString().slice(0, 10);
    for (const route of routes) {
      tasks.push({ ...route, date });
    }
  }

  const pending: Task[] = [];

  for (const task of tasks) {
    const existing = await prisma.flightSearch.findFirst({
      where: {
        departureCode: task.from,
        arrivalCode: task.to,
        outboundDate: new Date(`${task.date}T00:00:00.000Z`),
        adults: 1,
        travelClass: 1,
        currency: "VND",
      },
      select: { id: true },
    });

    if (!existing) pending.push(task);
  }

  console.log(`Tổng: ${tasks.length}; đã lưu: ${tasks.length - pending.length}; còn thiếu: ${pending.length}`);
  console.log("Một số mục còn thiếu:", pending.slice(0, 10));
  if (!process.argv.includes("--run") || pending.length === 0) return;

  const apiKey = process.env.SERPAPI_API_KEY;
  if (!apiKey) throw new Error("Thiếu SERPAPI_API_KEY trong server/.env");

  const accountUrl = new URL("https://serpapi.com/account.json");
  accountUrl.searchParams.set("api_key", apiKey);

  const accountResponse = await fetch(accountUrl);
  const account: any = await accountResponse.json();

  if (!accountResponse.ok || account.error) {
    throw new Error("Không kiểm tra được hạn mức SerpApi; dừng import.");
  }

  const monthlyLeft = Number(account.total_searches_left);
  const hourlyLimit = Number(account.account_rate_limit_per_hour);
  const hourlyUsed = Number(account.this_hour_searches);

  if (![monthlyLeft, hourlyLimit, hourlyUsed].every(Number.isFinite)) {
    throw new Error("SerpApi không trả đủ thông tin hạn mức; dừng import.");
  }

  const batchSize = Math.max(
    0,
    Math.min(20, pending.length, monthlyLeft, hourlyLimit - hourlyUsed - 5),
  );

  console.log(`Có thể nhập ${batchSize} mục trong đợt này.`);
  if (batchSize === 0) return;

  for (const task of pending.slice(0, batchSize)) {
    console.log(`Đang nhập ${task.from} → ${task.to}, ${task.date}`);
    execFileSync(
      process.execPath,
      ["--import", "tsx", "src/import-flights.ts", task.from, task.to, task.date],
      { cwd: process.cwd(), stdio: "inherit" },
    );
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });