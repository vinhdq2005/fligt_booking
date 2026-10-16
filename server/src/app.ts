
import express from "express";
import { authStore, canUseAccount, hashPassword, hashSession, newSessionToken, publicUser, SESSION_AGE_MS, verifyPassword } from "./modules/auth/auth.service";
import type { AuthStore, AuthUser } from "./modules/auth/auth.service";

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

type FlightManagement = { createFlight: typeof createFlight; listManagedFlights: typeof listManagedFlights };

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

export function createApp(
  importer: FlightImporter,
  catalog: FlightCatalog,
  store: AuthStore = authStore,
  management: FlightManagement = { createFlight, listManagedFlights },
) {
  const app = express();

  app.use(express.json({ limit: "16kb" }));
  const cookieName = "flight_session";
  const isMutation = (method: string) => !["GET", "HEAD", "OPTIONS"].includes(method);
  const csrf = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (isMutation(req.method) && req.header("x-csrf-intent") !== "1") {
      res.status(403).json({ error: "Yêu cầu thiếu xác nhận CSRF." });
      return;
    }
    next();
  };
  const tokenFromCookie = (req: express.Request) => {
    const value = req.headers.cookie?.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1);
    return value && /^[a-f0-9]{64}$/.test(value) ? value : null;
  };
  const cookieOptions = { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/", maxAge: SESSION_AGE_MS };
  const currentUser = async (req: express.Request): Promise<AuthUser | null> => {
    const token = tokenFromCookie(req);
    if (!token) return null;
    const session = await store.findBySession(hashSession(token));
    if (!session || session.expiresAt <= new Date() || !canUseAccount(session.user)) return null;
    return session.user;
  };
  const requireRole = (...roles: AuthUser["role"][]) => async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
      const user = await currentUser(req);
      if (!user) { res.status(401).json({ error: "Vui lòng đăng nhập." }); return; }
      if (!roles.includes(user.role)) { res.status(403).json({ error: "Không có quyền truy cập." }); return; }
      res.locals.authUser = user;
      next();
    } catch (error) { next(error); }
  };

  app.post("/api/auth/register", csrf, async (req, res, next) => {
    try {
      const { name, email, password } = req.body ?? {};
      if (typeof name !== "string" || name.trim().length < 2 || name.trim().length > 120 ||
          typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) || email.trim().length > 255 ||
          typeof password !== "string" || password.length < 10 || password.length > 128) {
        res.status(400).json({ error: "Tên, email hoặc mật khẩu không hợp lệ (mật khẩu tối thiểu 10 ký tự)." }); return;
      }
      const normalizedEmail = email.trim().toLowerCase();
      if (await store.findByEmail(normalizedEmail)) { res.status(409).json({ error: "Email đã được sử dụng." }); return; }
      const user = await store.createCustomer({ name: name.trim(), email: normalizedEmail, passwordHash: await hashPassword(password) });
      res.status(201).json({ user: publicUser(user) });
    } catch (error) {
      if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
        res.status(409).json({ error: "Email đã được sử dụng." }); return;
      }
      next(error);
    }
  });
  app.post("/api/auth/login", csrf, async (req, res, next) => {
    try {
      const { email, password } = req.body ?? {};
      if (typeof email !== "string" || typeof password !== "string") { res.status(400).json({ error: "Cần email và mật khẩu." }); return; }
      const user = await store.findByEmail(email.trim().toLowerCase());
      if (!user || !await verifyPassword(password, user.passwordHash)) { res.status(401).json({ error: "Email hoặc mật khẩu không đúng." }); return; }
      if (!canUseAccount(user)) { res.status(403).json({ error: "Tài khoản hoặc hãng bay đang bị khóa." }); return; }
      const token = newSessionToken();
      await store.createSession({ id: hashSession(token), userId: user.id, expiresAt: new Date(Date.now() + SESSION_AGE_MS) });
      await store.recordLogin(user.id);
      res.cookie(cookieName, token, cookieOptions).json({ user: publicUser(user) });
    } catch (error) { next(error); }
  });
  app.get("/api/auth/me", async (req, res, next) => {
    try { const user = await currentUser(req); if (!user) { res.status(401).json({ error: "Vui lòng đăng nhập." }); return; } res.json({ user: publicUser(user) }); }
    catch (error) { next(error); }
  });
  app.patch("/api/auth/me", csrf, requireRole("CUSTOMER", "ADMIN", "AIRLINE_FLIGHT_MANAGER", "AIRLINE_SALES_MANAGER"), async (req, res, next) => {
    try {
      const { name, phone } = req.body ?? {};
      if (typeof name !== "string" || name.trim().length < 2 || name.trim().length > 120 ||
          (phone !== null && phone !== undefined && (typeof phone !== "string" || phone.trim().length > 20))) {
        res.status(400).json({ error: "Thông tin cá nhân không hợp lệ." }); return;
      }
      const user = await store.updateProfile(res.locals.authUser.id, { name: name.trim(), phone: typeof phone === "string" && phone.trim() ? phone.trim() : null });
      res.json({ user: publicUser(user) });
    } catch (error) { next(error); }
  });
  app.post("/api/auth/logout", csrf, async (req, res, next) => {
    try { const token = tokenFromCookie(req); if (token) await store.deleteSession(hashSession(token)); res.clearCookie(cookieName, { path: "/" }).status(204).end(); }
    catch (error) { next(error); }
  });

  app.use("/api/admin", requireRole("ADMIN"), csrf);
  app.use("/api/airline", requireRole("AIRLINE_FLIGHT_MANAGER", "AIRLINE_SALES_MANAGER"), csrf);

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
        res.json(await management.listManagedFlights());
      } catch (error) {
        next(error);
      }
    },
  );

  app.get("/api/airline/managed-flights", async (_req, res, next) => {
    try { res.json(await management.listManagedFlights(res.locals.authUser.airlineId)); }
    catch (error) { next(error); }
  });

  app.post(
    "/api/airline/managed-flights",
    requireRole("AIRLINE_FLIGHT_MANAGER"),
    async (req, res, next) => {
      try {
        const body = req.body ?? {};

        const {
          flightNumber,
          departureCode,
          arrivalCode,
          departureTime,
          arrivalTime,
          capacity,
          basePrice,
        } = body;

        if (
          typeof flightNumber !== "string" ||
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

        const flight = await management.createFlight({
          flightNumber,
          airlineId: res.locals.authUser.airlineId,
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

      const bookingUser = await currentUser(req);
      const booking = await createBooking({
        flightId,
        userId: bookingUser?.role === "CUSTOMER" ? bookingUser.id : undefined,
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
