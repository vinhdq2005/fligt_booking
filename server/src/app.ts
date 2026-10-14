
import express from "express";
import { timingSafeEqual } from "node:crypto";

import { getBookingByCode } from "./modules/bookings/booking-query.service";
import { payBooking } from "./modules/bookings/payment.service";
import { createBooking } from "./modules/bookings/booking.service";
import { listAirportCodes } from "./modules/airports/airport.service";

import {
  searchFlights,
  getFlightById,
} from "./modules/flights/flight-search.service";

import {
  createFlight,
  listManagedFlights,
} from "./modules/flights/flight-management.service";

import {
  createAirline,
  listAirlines,
  listPublicAirlines,
} from "./modules/airlines/airline.service";

import type { ImportRequest } from "./modules/flight-import/import.service";
import { InvalidImportRequestError } from "./modules/flight-import/errors";
import type { FlightFilters } from "./modules/flights/flight-list.service";

type FlightImporter = Pick<
  typeof import("./modules/flight-import/import.service"),
  "getImportStatus" | "importFlights"
>;

type FlightCatalog = Pick<
  typeof import("./modules/flights/flight-list.service"),
  "listFlights"
>;

function parseFlightFilters(
  query: Record<string, unknown>,
): FlightFilters | null {
  const value = (key: string) =>
    query[key] === undefined ? undefined : query[key];

  const from = value("from");
  const to = value("to");
  const date = value("date");
  const status = value("status") ?? "all";
  const pageText = value("page") ?? "1";
  const page = Number(pageText);

  if (
    (from !== undefined &&
      (typeof from !== "string" || !/^[A-Z]{3}$/.test(from))) ||
    (to !== undefined &&
      (typeof to !== "string" || !/^[A-Z]{3}$/.test(to))) ||
    (date !== undefined &&
      (typeof date !== "string" ||
        !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
        Number.isNaN(
          new Date(`${date}T00:00:00.000Z`).getTime(),
        ) ||
        new Date(`${date}T00:00:00.000Z`)
          .toISOString()
          .slice(0, 10) !== date)) ||
    (status !== "all" &&
      status !== "fresh" &&
      status !== "expired") ||
    !Number.isInteger(page) ||
    page < 1 ||
    page > 100000
  ) {
    return null;
  }

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
  if (!value || typeof value !== "object") {
    return null;
  }

  const data = value as Record<string, unknown>;

  if (
    typeof data.departureCode !== "string" ||
    typeof data.arrivalCode !== "string" ||
    typeof data.date !== "string"
  ) {
    return null;
  }

  return {
    departureCode: data.departureCode,
    arrivalCode: data.arrivalCode,
    dateText: data.date,
  };
}

function matchesToken(
  header: string | undefined,
  expected: string,
): boolean {
  if (!header?.startsWith("Bearer ")) {
    return false;
  }

  const actual = Buffer.from(header.slice(7));
  const secret = Buffer.from(expected);

  return (
    actual.length === secret.length &&
    timingSafeEqual(actual, secret)
  );
}

export function createApp(
  adminToken: string,
  importer: FlightImporter,
  catalog: FlightCatalog,
) {
  if (!adminToken) {
    throw new Error("Thiếu ADMIN_API_TOKEN");
  }

  const app = express();

  app.use(express.json({ limit: "16kb" }));

  app.use("/api/admin", (req, res, next) => {
    if (!matchesToken(req.header("authorization"), adminToken)) {
      res.status(401).json({
        error: "Cần token quản trị hợp lệ.",
      });
      return;
    }

    next();
  });

  // =========================
  // ADMIN: DANH SÁCH CHUYẾN BAY
  // =========================

  app.get("/api/admin/flights", async (req, res, next) => {
    try {
      const filters = parseFlightFilters(req.query);

      if (!filters) {
        res.status(400).json({
          error: "Bộ lọc chuyến bay không hợp lệ.",
        });
        return;
      }

      res.json(await catalog.listFlights(filters));
    } catch (error) {
      next(error);
    }
  });

  // =========================
  // ADMIN: HÃNG BAY
  // =========================

  app.get("/api/admin/airlines", async (_req, res, next) => {
    try {
      res.json(await listAirlines());
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/admin/airlines", async (req, res, next) => {
    try {
      const { code, name } = req.body ?? {};

      if (
        typeof code !== "string" ||
        typeof name !== "string"
      ) {
        res.status(400).json({
          error: "Cần cung cấp code và name dạng chuỗi.",
        });
        return;
      }

      const airline = await createAirline({ code, name });

      res.status(201).json(airline);
    } catch (error) {
      if (
        error instanceof Error &&
        (error.message.includes("Mã hãng bay") ||
          error.message.includes("Tên hãng bay"))
      ) {
        res.status(400).json({ error: error.message });
        return;
      }

      next(error);
    }
  });

  // =========================
  // ADMIN: QUẢN LÝ CHUYẾN BAY
  // =========================

  app.get(
    "/api/admin/managed-flights",
    async (_req, res, next) => {
      try {
        res.json(await listManagedFlights());
      } catch (error) {
        next(error);
      }
    },
  );

  app.post(
    "/api/admin/managed-flights",
    async (req, res, next) => {
      try {
        const body = req.body ?? {};

        const {
          flightNumber,
          airlineId,
          departureCode,
          arrivalCode,
          departureTime,
          arrivalTime,
          capacity,
          basePrice,
        } = body;

        if (
          typeof flightNumber !== "string" ||
          typeof airlineId !== "number" ||
          typeof departureCode !== "string" ||
          typeof arrivalCode !== "string" ||
          typeof departureTime !== "string" ||
          typeof arrivalTime !== "string" ||
          typeof capacity !== "number" ||
          typeof basePrice !== "number"
        ) {
          res.status(400).json({
            error:
              "Dữ liệu chuyến bay không hợp lệ hoặc thiếu trường bắt buộc.",
          });
          return;
        }

        const flight = await createFlight({
          flightNumber,
          airlineId,
          departureCode,
          arrivalCode,
          departureTime,
          arrivalTime,
          capacity,
          basePrice,
        });

        res.status(201).json(flight);
      } catch (error) {
        if (
          error instanceof Error &&
          [
            "Số hiệu chuyến bay",
            "Mã sân bay",
            "Mã hãng bay",
            "Số ghế",
            "Giá vé",
            "Thời gian đến",
          ].some((message) => error.message.includes(message))
        ) {
          res.status(400).json({ error: error.message });
          return;
        }

        next(error);
      }
    },
  );

  // =========================
  // PUBLIC: TÌM CHUYẾN BAY
  // =========================

  app.get("/api/airlines", async (_req, res, next) => {
    try {
      res.json({ items: await listPublicAirlines() });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/airports", async (_req, res, next) => {
    try {
      res.json({ codes: await listAirportCodes() });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/flights/search", async (req, res, next) => {
    try {
      const { from, to, date, airline } = req.query;

      if (
        typeof from !== "string" ||
        typeof to !== "string" ||
        typeof date !== "string" ||
        (airline !== undefined && typeof airline !== "string")
      ) {
        res.status(400).json({
          error: "Vui lòng cung cấp from, to và date.",
        });
        return;
      }

      const flights = await searchFlights({
        from,
        to,
        date,
        airline,
      });

      res.json({
        items: flights,
        total: flights.length,
      });
    } catch (error) {
      if (
        error instanceof Error &&
        [
          "Mã sân bay phải gồm 3 chữ cái.",
          "Sân bay đi và sân bay đến không được trùng nhau.",
          "Ngày bay phải có định dạng YYYY-MM-DD.",
          "Ngày bay không hợp lệ.",
          "Mã hãng bay không hợp lệ.",
        ].includes(error.message)
      ) {
        res.status(400).json({ error: error.message });
        return;
      }

      next(error);
    }
  });

  // =========================
  // PUBLIC: CHI TIẾT CHUYẾN BAY
  // =========================

  app.get("/api/flights/:id", async (req, res, next) => {
    try {
      const id = Number(req.params.id);

      if (!Number.isInteger(id) || id < 1) {
        res.status(400).json({
          error: "Mã chuyến bay không hợp lệ.",
        });
        return;
      }

      const flight = await getFlightById(id);

      if (!flight) {
        res.status(404).json({
          error: "Không tìm thấy chuyến bay.",
        });
        return;
      }

      res.json({ item: flight });
    } catch (error) {
      next(error);
    }
  });

  // =========================
  // PUBLIC: TẠO BOOKING
  // =========================

  app.post("/api/bookings", async (req, res, next) => {
    try {
      const body = req.body ?? {};

      const {
        flightId,
        contactName,
        contactEmail,
        contactPhone,
        passengers,
      } = body;

      if (
        typeof flightId !== "number" ||
        typeof contactName !== "string" ||
        typeof contactEmail !== "string" ||
        typeof contactPhone !== "string" ||
        !Array.isArray(passengers) ||
        passengers.some(
          (p: unknown) =>
            typeof p !== "object" ||
            p === null ||
            Array.isArray(p) ||
            typeof (p as { fullName?: unknown }).fullName !== "string" ||
            typeof (p as { documentNumber?: unknown }).documentNumber !== "string" ||
            typeof (p as { gender?: unknown }).gender !== "string" ||
            typeof (p as { dateOfBirth?: unknown }).dateOfBirth !== "string" ||
            typeof (p as { nationality?: unknown }).nationality !== "string",
        )
      ) {
        res.status(400).json({
          error:
            "Thông tin đặt chỗ hoặc danh sách hành khách không hợp lệ.",
        });
        return;
      }

      const booking = await createBooking({
        flightId,
        contactName,
        contactEmail,
        contactPhone,
        passengers,
      });

      res.status(201).json({
        message:
          "Tạo đặt chỗ thành công. Vui lòng hoàn tất thanh toán.",
        item: booking,
      });
    } catch (error) {
      if (error instanceof Error) {
        const validationMessages = [
          "Mã chuyến bay không hợp lệ.",
          "Tên người liên hệ phải từ 2 đến 120 ký tự.",
          "Email không hợp lệ.",
          "Số điện thoại không hợp lệ.",
          "Số hành khách phải từ 1 đến 9.",
          "Tên hành khách phải từ 2 đến 120 ký tự.",
          "CCCD phải gồm đúng 12 chữ số.",
          "Giới tính không hợp lệ.",
          "Quốc tịch phải từ 2 đến 80 ký tự.",
          "Ngày sinh phải có định dạng YYYY-MM-DD.",
          "Ngày sinh không hợp lệ.",
          "Không tìm thấy chuyến bay.",
          "Chuyến bay không còn nhận đặt chỗ.",
          "Không đủ ghế cho số hành khách yêu cầu.",
          "Tổng tiền vượt giới hạn cho phép.",
        ];

        if (validationMessages.includes(error.message)) {
          res.status(400).json({ error: error.message });
          return;
        }
      }

      next(error);
    }
  });

  // =========================
  // PUBLIC: THANH TOÁN BOOKING
  // =========================

  app.post(
    "/api/bookings/:code/pay",
    async (req, res, next) => {
      try {
        const code = req.params.code;

        if (typeof code !== "string" || !code.trim()) {
          res.status(400).json({
            message: "Mã đặt chỗ không hợp lệ.",
          });
          return;
        }

        const result = await payBooking(code);

        res.status(200).json(result);
      } catch (error) {
        if (error instanceof Error) {
          const message = error.message;

          if (message === "Không tìm thấy đặt chỗ.") {
            res.status(404).json({ message });
            return;
          }

          if (
            message === "Đặt chỗ đã hết hạn thanh toán." ||
            message ===
              "Đặt chỗ không ở trạng thái chờ thanh toán." ||
            message ===
              "Đặt chỗ đã có vé; không thể thanh toán lại."
          ) {
            res.status(409).json({ message });
            return;
          }

          if (
            message === "Mã đặt chỗ không hợp lệ." ||
            message === "Đặt chỗ chưa có hành khách." ||
            message === "Chuyến bay không còn khả dụng."
          ) {
            res.status(400).json({ message });
            return;
          }
        }

        next(error);
      }
    },
  );

  // =========================
  // PUBLIC: TRA CỨU BOOKING
  // =========================

  app.get("/api/bookings/:code", async (req, res, next) => {
    try {
      const code = req.params.code;

      if (typeof code !== "string" || !code.trim()) {
        res.status(400).json({
          message: "Mã đặt chỗ không hợp lệ.",
        });
        return;
      }

      const item = await getBookingByCode(code);

      res.status(200).json({ item });
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === "Không tìm thấy đặt chỗ."
      ) {
        res.status(404).json({
          message: error.message,
        });
        return;
      }

      if (
        error instanceof Error &&
        error.message === "Mã đặt chỗ không hợp lệ."
      ) {
        res.status(400).json({
          message: error.message,
        });
        return;
      }

      next(error);
    }
  });

  // =========================
  // ADMIN: TRẠNG THÁI IMPORT
  // =========================

  app.get(
    "/api/admin/flight-imports/status",
    async (req, res, next) => {
      try {
        const request = parseImportRequest(req.query);

        if (!request) {
          res.status(400).json({
            error:
              "Cần departureCode, arrivalCode và date.",
          });
          return;
        }

        res.json(await importer.getImportStatus(request));
      } catch (error) {
        next(error);
      }
    },
  );

  // =========================
  // ADMIN: IMPORT CHUYẾN BAY
  // =========================

  app.post(
    "/api/admin/flight-imports",
    async (req, res, next) => {
      try {
        const request = parseImportRequest(req.body);

        if (!request) {
          res.status(400).json({
            error:
              "Cần departureCode, arrivalCode và date.",
          });
          return;
        }

        const confirmed = req.body.confirmed === true;

        const result = await importer.importFlights(
          request,
          confirmed,
        );

        if (result.status === "confirmation_required") {
          res.status(428).json(result);
        } else {
          res
            .status(result.status === "imported" ? 201 : 200)
            .json(result);
        }
      } catch (error) {
        next(error);
      }
    },
  );

  // =========================
  // ERROR HANDLER
  // =========================

  app.use(
    (
      error: unknown,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      if (error instanceof InvalidImportRequestError) {
        res.status(400).json({ error: error.message });
        return;
      }

      console.error(error);

      res.status(500).json({
        error: "Không xử lý được yêu cầu import.",
      });
    },
  );

  return app;
}
