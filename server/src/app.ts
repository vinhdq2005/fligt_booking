import {
  verifyTicketQR,
  checkInTicketQR,
  TicketServiceError,
} from "./modules/tickets/ticket.service";
import express from "express";
import { authStore, canUseAccount, hashPassword, hashSession, newSessionToken, publicUser, SESSION_AGE_MS, verifyPassword } from "./modules/auth/auth.service";
import type { AuthStore, AuthUser } from "./modules/auth/auth.service";
import { getAdminDetail, getAdminOptions, getAdminOverview, listAdminData, listKinds, parseReadQuery } from "./modules/admin/admin-read.service";
import type { ListKind, ReadQuery } from "./modules/admin/admin-read.service";
import { InterventionError, parseInterventionInput, runAdminIntervention } from "./modules/admin/admin-intervention.service";
import { CreateStaffError, createAirlineStaff, parseCreateStaffInput } from "./modules/admin/admin-user.service";
import { AirlineWorkspaceError, getAirlineWorkspace, parseAirlineWorkspaceQuery, setAirlineSalesSettings, setAirlineSaleStatus } from "./modules/airlines/airline-workspace.service";
import { getAirlineDashboard, parseAirlineDashboardQuery } from "./modules/airlines/airline-dashboard.service";
import { getAirlineBooking, listAirlineBookings, parseAirlineBookingQuery } from "./modules/airlines/airline-bookings.service";

import { getBookingByCode } from "./modules/bookings/booking-query.service";
import { payBooking } from "./modules/bookings/payment.service";
import { getVietQrPayment, VietQrError } from "./modules/bookings/vietqr.service";
import { createBooking } from "./modules/bookings/booking.service";
import { listAirportCodes } from "./modules/airports/airport.service";

import {
  searchFlights,
  getFlightCalendarPrices,
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
type AdminReader = {
  list: (kind: ListKind, query: ReadQuery) => Promise<unknown>;
  detail: (kind: ListKind, id: number) => Promise<unknown>;
  options: typeof getAdminOptions;
  overview: typeof getAdminOverview;
};

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
  reader: AdminReader = { list: listAdminData, detail: getAdminDetail, options: getAdminOptions, overview: getAdminOverview },
  intervention: typeof runAdminIntervention = runAdminIntervention,
  staffCreator: typeof createAirlineStaff = createAirlineStaff,
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

  app.get("/api/airline/workspace", async (req, res, next) => {
    try {
      const query = parseAirlineWorkspaceQuery(req.query);
      if (!query) { res.status(400).json({ error: "Bộ lọc hãng bay không hợp lệ." }); return; }
      res.json(await getAirlineWorkspace(res.locals.authUser.airlineId, query));
    }
    catch (error) { if (error instanceof AirlineWorkspaceError) { res.status(error.status).json({ error: error.message }); return; } next(error); }
  });
  app.get("/api/airline/dashboard", requireRole("AIRLINE_SALES_MANAGER"), async (req, res, next) => {
    try {
      const query = parseAirlineDashboardQuery(req.query);
      if (!query) { res.status(400).json({ error: "Bộ lọc Dashboard không hợp lệ." }); return; }
      res.json(await getAirlineDashboard(res.locals.authUser.airlineId, query));
    } catch (error) { next(error); }
  });
  app.get("/api/airline/bookings", requireRole("AIRLINE_SALES_MANAGER"), async (req, res, next) => {
    try {
      const query = parseAirlineBookingQuery(req.query);
      if (!query) { res.status(400).json({ error: "Bộ lọc đặt chỗ không hợp lệ." }); return; }
      res.json(await listAirlineBookings(res.locals.authUser.airlineId, query));
    } catch (error) { next(error); }
  });
  app.get("/api/airline/bookings/:id", requireRole("AIRLINE_SALES_MANAGER"), async (req, res, next) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isSafeInteger(id) || id < 1) { res.status(400).json({ error: "Mã đặt chỗ không hợp lệ." }); return; }
      const item = await getAirlineBooking(res.locals.authUser.airlineId, id);
      if (!item) { res.status(404).json({ error: "Không tìm thấy đặt chỗ của hãng." }); return; }
      res.json({ item });
    } catch (error) { next(error); }
  });
  app.put("/api/airline/flights/:id/sales-settings", requireRole("AIRLINE_SALES_MANAGER"), async (req, res, next) => {
    try {
      const flightId = Number(req.params.id);
      const { capacity, basePrice } = req.body ?? {};
      if (!Number.isSafeInteger(flightId) || flightId < 1 || typeof capacity !== "number" || typeof basePrice !== "number") { res.status(400).json({ error: "Chuyến bay, số ghế hoặc giá gốc không hợp lệ." }); return; }
      res.json(await setAirlineSalesSettings({ airlineId: res.locals.authUser.airlineId, actorId: res.locals.authUser.id, flightId, capacity, basePrice }));
    } catch (error) { if (error instanceof AirlineWorkspaceError) { res.status(error.status).json({ error: error.message }); return; } next(error); }
  });
  app.put("/api/airline/flights/:id/sale-status", requireRole("AIRLINE_SALES_MANAGER"), async (req, res, next) => {
    try {
      const flightId = Number(req.params.id);
      const saleStatus = req.body?.saleStatus;
      if (!Number.isSafeInteger(flightId) || flightId < 1 || (saleStatus !== "ON_SALE" && saleStatus !== "HIDDEN")) { res.status(400).json({ error: "Chuyến bay hoặc trạng thái mở bán không hợp lệ." }); return; }
      res.json(await setAirlineSaleStatus({ airlineId: res.locals.authUser.airlineId, actorId: res.locals.authUser.id, flightId, saleStatus }));
    } catch (error) { if (error instanceof AirlineWorkspaceError) { res.status(error.status).json({ error: error.message }); return; } next(error); }
  });

  app.post("/api/admin/users", async (req, res, next) => {
    try {
      const input = parseCreateStaffInput(req.body, res.locals.authUser.id);
      if (!input) { res.status(400).json({ error: "Tên, email, mật khẩu (10–128 ký tự), vai trò hoặc hãng bay không hợp lệ." }); return; }
      const user = await staffCreator(input);
      res.status(201).json({ user });
    } catch (error) {
      if (error instanceof CreateStaffError) { res.status(error.status).json({ error: error.message }); return; }
      next(error);
    }
  });

  app.post("/api/admin/interventions", async (req, res, next) => {
    try {
      const input = parseInterventionInput(req.body, req.header("idempotency-key"), res.locals.authUser.id);
      if (!input) { res.status(400).json({ error: "Hành động, ID, lý do (10–1000 ký tự) hoặc Idempotency-Key không hợp lệ." }); return; }
      const result = await intervention(input);
      res.status(result.status === "applied" ? 201 : 200).json(result);
    } catch (error) {
      if (error instanceof InterventionError) { res.status(error.status).json({ error: error.message }); return; }
      next(error);
    }
  });

  app.get("/api/admin/overview", async (req, res, next) => {
    try {
      const { fromDate, toDate } = req.query;
      if ((fromDate !== undefined && typeof fromDate !== "string") || (toDate !== undefined && typeof toDate !== "string")) {
        res.status(400).json({ error: "Khoảng ngày không hợp lệ." }); return;
      }
      const item = await reader.overview(fromDate as string | undefined, toDate as string | undefined);
      if (!item) { res.status(400).json({ error: "Khoảng ngày không hợp lệ." }); return; }
      res.json({ item });
    } catch (error) { next(error); }
  });
  app.get("/api/admin/read/options", async (_req, res, next) => {
    try { res.json(await reader.options()); } catch (error) { next(error); }
  });
  app.get("/api/admin/read/:kind", async (req, res, next) => {
    try {
      const kind = req.params.kind;
      if (typeof kind !== "string" || !listKinds.includes(kind as ListKind)) { res.status(404).json({ error: "Không tìm thấy danh sách." }); return; }
      const query = parseReadQuery(kind as ListKind, req.query);
      if (!query) { res.status(400).json({ error: "Bộ lọc không hợp lệ." }); return; }
      res.json(await reader.list(kind as ListKind, query));
    } catch (error) { next(error); }
  });
  app.get("/api/admin/read/:kind/:id", async (req, res, next) => {
    try {
      const kind = req.params.kind;
      const id = Number(req.params.id);
      if (typeof kind !== "string" || !listKinds.includes(kind as ListKind)) { res.status(404).json({ error: "Không tìm thấy danh sách." }); return; }
      if (!Number.isSafeInteger(id) || id < 1) { res.status(400).json({ error: "ID không hợp lệ." }); return; }
      const item = await reader.detail(kind as ListKind, id);
      if (!item) { res.status(404).json({ error: "Không tìm thấy bản ghi." }); return; }
      res.json({ item });
    } catch (error) { next(error); }
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
        } = body;

        if (
          typeof flightNumber !== "string" ||
          typeof departureCode !== "string" ||
          typeof arrivalCode !== "string" ||
          typeof departureTime !== "string" ||
          typeof arrivalTime !== "string" ||
          body.capacity !== undefined ||
          body.basePrice !== undefined
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
        });

        res.status(201).json(flight);
      } catch (error) {
        if (error instanceof Error && error.message === "Hãng bay đang bị khóa hoặc không tồn tại.") {
          res.status(409).json({ error: error.message });
          return;
        }
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

  app.get("/api/flights/calendar-prices", async (req, res, next) => {
    try {
      const { from, to, start, end, airline, passengers } = req.query;
      if ([from, to, start, end, passengers].some(value => typeof value !== "string") ||
          (airline !== undefined && typeof airline !== "string")) {
        res.status(400).json({ error: "Thông tin lịch giá không hợp lệ." });
        return;
      }
      const items = await getFlightCalendarPrices({
        from: from as string,
        to: to as string,
        start: start as string,
        end: end as string,
        passengers: Number(passengers),
        airline: airline as string | undefined,
      });
      res.json({ items });
    } catch (error) {
      if (error instanceof Error && error.message === "Thông tin lịch giá không hợp lệ.") {
        res.status(400).json({ error: error.message });
        return;
      }
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
        returnFlightId,
        contactName,
        contactEmail,
        contactPhone,
        passengers,
      } = body;

      if (
        typeof flightId !== "number" ||
        (returnFlightId !== undefined && typeof returnFlightId !== "number") ||
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
        returnFlightId,
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
          "Mã chuyến bay chiều về không hợp lệ.",
          "Chuyến về không khớp hành trình hoặc thời gian chiều đi.",
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

  app.get("/api/bookings/:code/payment-qr", async (req, res, next) => {
    try {
      const code = req.params.code;
      if (typeof code !== "string" || !code.trim()) {
        res.status(400).json({ error: "Mã đặt chỗ không hợp lệ." });
        return;
      }
      res.json({ item: await getVietQrPayment(code) });
    } catch (error) {
      if (error instanceof VietQrError) {
        res.status(error.statusCode).json({ error: error.message });
        return;
      }
      next(error);
    }
  });

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
// AIRLINE: XÁC MINH QR VÉ
// =========================

app.get(
  "/api/tickets/verify/:token",
  requireRole(
    "AIRLINE_FLIGHT_MANAGER",
    "AIRLINE_SALES_MANAGER",
  ),
  async (req, res, next) => {
    try {
      const token = req.params.token;

      if (typeof token !== "string" || !token.trim()) {
        res.status(400).json({
          error: "Mã QR không hợp lệ.",
        });
        return;
      }

      const result = await verifyTicketQR(token);

      res.json({
        item: result,
      });
    } catch (error) {
      if (error instanceof TicketServiceError) {
        res.status(error.statusCode).json({
          error: error.message,
        });
        return;
      }

      next(error);
    }
  },
);

/**
 * PUBLIC: XÁC MINH QR VÉ
 * Chỉ đọc thông tin vé, không thực hiện check-in.
 */
app.get(
  "/api/public/tickets/verify/:token",
  async (req, res, next) => {
    try {
      const token = req.params.token;

      if (typeof token !== "string" || !token.trim()) {
        res.status(400).json({
          error: "Mã QR không hợp lệ.",
        });
        return;
      }

      const result = await verifyTicketQR(token);

      res.json({
        item: result,
      });
    } catch (error) {
      if (error instanceof TicketServiceError) {
        res.status(error.statusCode).json({
          error: error.message,
        });
        return;
      }

      next(error);
    }
  },
);

// =========================
// AIRLINE: CHECK-IN QR VÉ
// =========================

app.post(
  "/api/tickets/check-in/:token",
  requireRole("AIRLINE_FLIGHT_MANAGER"),
  csrf,
  async (req, res, next) => {
    try {
      const token = req.params.token;

      if (typeof token !== "string" || !token.trim()) {
        res.status(400).json({
          error: "Mã QR không hợp lệ.",
        });
        return;
      }

      const staff = res.locals.authUser;

      const result = await checkInTicketQR(token, {
        id: staff.id,
        role: staff.role,
        airlineId: staff.airlineId,
      });

      res.json(result);
    } catch (error) {
      if (error instanceof TicketServiceError) {
        res.status(error.statusCode).json({
          error: error.message,
        });
        return;
      }

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
