import express from "express";
import { timingSafeEqual } from "node:crypto";
import type { ImportRequest } from "./modules/flight-import/import.service";
import { InvalidImportRequestError } from "./modules/flight-import/errors";
import type { FlightFilters } from "./modules/flights/flight-list.service";

type FlightImporter = Pick<
  typeof import("./modules/flight-import/import.service"),
  "getImportStatus" | "importFlights"
>;
type FlightCatalog = Pick<typeof import("./modules/flights/flight-list.service"), "listFlights">;

function parseFlightFilters(query: Record<string, unknown>): FlightFilters | null {
  const value = (key: string) => query[key] === undefined ? undefined : query[key];
  const from = value("from");
  const to = value("to");
  const date = value("date");
  const status = value("status") ?? "all";
  const pageText = value("page") ?? "1";
  const page = Number(pageText);
  if ((from !== undefined && (typeof from !== "string" || !/^[A-Z]{3}$/.test(from))) ||
      (to !== undefined && (typeof to !== "string" || !/^[A-Z]{3}$/.test(to))) ||
      (date !== undefined && (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
        Number.isNaN(new Date(`${date}T00:00:00.000Z`).getTime()) ||
        new Date(`${date}T00:00:00.000Z`).toISOString().slice(0, 10) !== date)) ||
      (status !== "all" && status !== "fresh" && status !== "expired") ||
      !Number.isInteger(page) || page < 1 || page > 100000) return null;
  return {
    from: from as string | undefined,
    to: to as string | undefined,
    date: date as string | undefined,
    status,
    page,
    pageSize: 15,
  };
}

function parseImportRequest(value: unknown): ImportRequest | null {
  if (!value || typeof value !== "object") return null;
  const data = value as Record<string, unknown>;
  if (typeof data.departureCode !== "string" ||
      typeof data.arrivalCode !== "string" ||
      typeof data.date !== "string") return null;
  return {
    departureCode: data.departureCode,
    arrivalCode: data.arrivalCode,
    dateText: data.date,
  };
}

function matchesToken(header: string | undefined, expected: string): boolean {
  if (!header?.startsWith("Bearer ")) return false;
  const actual = Buffer.from(header.slice(7));
  const secret = Buffer.from(expected);
  return actual.length === secret.length && timingSafeEqual(actual, secret);
}

export function createApp(adminToken: string, importer: FlightImporter, catalog: FlightCatalog) {
  if (!adminToken) throw new Error("Thiếu ADMIN_API_TOKEN");
  const app = express();
  app.use(express.json({ limit: "16kb" }));

  app.use("/api/admin", (req, res, next) => {
    if (!matchesToken(req.header("authorization"), adminToken)) {
      res.status(401).json({ error: "Cần token quản trị hợp lệ." });
      return;
    }
    next();
  });

  app.get("/api/admin/flights", async (req, res, next) => {
    try {
      const filters = parseFlightFilters(req.query);
      if (!filters) {
        res.status(400).json({ error: "Bộ lọc chuyến bay không hợp lệ." });
        return;
      }
      res.json(await catalog.listFlights(filters));
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/admin/flight-imports/status", async (req, res, next) => {
    try {
      const request = parseImportRequest(req.query);
      if (!request) {
        res.status(400).json({ error: "Cần departureCode, arrivalCode và date." });
        return;
      }
      res.json(await importer.getImportStatus(request));
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/admin/flight-imports", async (req, res, next) => {
    try {
      const request = parseImportRequest(req.body);
      if (!request) {
        res.status(400).json({ error: "Cần departureCode, arrivalCode và date." });
        return;
      }
      const confirmed = req.body.confirmed === true;
      const result = await importer.importFlights(request, confirmed);
      if (result.status === "confirmation_required") {
        res.status(428).json(result);
      } else {
        res.status(result.status === "imported" ? 201 : 200).json(result);
      }
    } catch (error) {
      next(error);
    }
  });

  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (error instanceof InvalidImportRequestError) {
      res.status(400).json({ error: error.message });
      return;
    }
    console.error(error);
    res.status(500).json({ error: "Không xử lý được yêu cầu import." });
  });

  return app;
}
