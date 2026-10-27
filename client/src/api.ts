
export type Segment = {
  id: number;
  position: number;
  flightNumber: string;
  airlineName: string;
  departureCode: string;
  arrivalCode: string;
  departureTime: string;
  arrivalTime: string;
  durationMinutes: number | null;
};

export type Flight = {
  id: number;
  searchId: number;
  category: string;
  price: number;
  currency: string;
  totalDurationMinutes: number | null;
  departureCode: string;
  arrivalCode: string;
  outboundDate: string;
  fetchedAt: string;
  expiresAt: string;
  status: "fresh" | "expired";
  segments: Segment[];
};

export type FlightList = {
  items: Flight[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    pageCount: number;
  };
  summary: {
    fresh: number;
    expired: number;
    total: number;
  };
};

export type ImportStatus = {
  status: "fresh" | "expired" | "missing";
  latestId?: number;
};

export type ImportForm = {
  departureCode: string;
  arrivalCode: string;
  date: string;
};

async function api<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const response = await fetch(path, {
    ...options,
    credentials: "same-origin",
    headers: {
      ...(options?.method && options.method !== "GET"
        ? { "x-csrf-intent": "1" }
        : {}),
      ...(options?.body
        ? { "content-type": "application/json" }
        : {}),
      ...options?.headers,
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      data.error || `Yêu cầu thất bại (HTTP ${response.status}).`,
    );
  }

  return data as T;
}

// ===== ADMIN FLIGHTS =====

export function getFlights(filters: {
  from: string;
  to: string;
  date: string;
  status: string;
  page: number;
}): Promise<FlightList> {
  const query = new URLSearchParams({
    page: String(filters.page),
    status: filters.status,
  });

  if (filters.from) query.set("from", filters.from);
  if (filters.to) query.set("to", filters.to);
  if (filters.date) query.set("date", filters.date);

  return api<FlightList>(`/api/admin/flights?${query}`);
}

export function getImportStatus(
  form: ImportForm,
): Promise<ImportStatus> {
  const query = new URLSearchParams(form);

  return api<ImportStatus>(
    `/api/admin/flight-imports/status?${query}`,
  );
}

export function importFlights(form: ImportForm) {
  return api<{
    status: "imported" | "already_fresh";
    searchId: number;
    offerCount?: number;
  }>("/api/admin/flight-imports", {
    method: "POST",
    body: JSON.stringify({
      ...form,
      confirmed: true,
    }),
  });
}

// ===== PUBLIC FLIGHTS =====

export type PublicFlight = {
  id: number;
  flightNumber: string;
  departureCode: string;
  arrivalCode: string;
  departureTime: string;
  arrivalTime: string;
  capacity: number;
  occupiedSeats: number;
  availableSeats: number;
  basePrice: number;
  currentPrice: number;
  pricingDetails: {
    occupancyPercent: number;
    timeMultiplier: number;
    occupancyMultiplier: number;
    departureMultiplier: number;
    pricedAt: string;
  };
  status: string;
  airline: {
    id: number;
    code: string;
    name: string;
  };
};

export async function getAirportCodes(): Promise<string[]> {
  const result = await api<{ codes: string[] }>("/api/airports");
  if (!Array.isArray(result.codes)) {
    throw new Error("Dữ liệu sân bay không hợp lệ.");
  }
  return result.codes;
}

export type PublicAirline = {
  code: string;
  name: string;
};

export async function getPublicAirlines(): Promise<PublicAirline[]> {
  const result = await api<{ items: PublicAirline[] }>("/api/airlines");
  if (!Array.isArray(result.items)) {
    throw new Error("Dữ liệu hãng bay không hợp lệ.");
  }
  return result.items;
}

export type PublicFlightSearchResult = {
  items: PublicFlight[];
  total: number;
};

export async function getFlightCalendarPrices(filters: {
  from: string;
  to: string;
  start: string;
  end: string;
  passengers: number;
  airline?: string;
}): Promise<{ items: { date: string; price: number }[] }> {
  const query = new URLSearchParams({
    from: filters.from,
    to: filters.to,
    start: filters.start,
    end: filters.end,
    passengers: String(filters.passengers),
  });
  if (filters.airline) query.set("airline", filters.airline);
  return api(`/api/flights/calendar-prices?${query.toString()}`);
}

export async function searchPublicFlights(filters: {
  from: string;
  to: string;
  date: string;
  airline?: string;
}): Promise<PublicFlightSearchResult> {
  const query = new URLSearchParams({
    from: filters.from,
    to: filters.to,
    date: filters.date,
  });

  if (filters.airline) {
    query.set("airline", filters.airline);
  }

  return api<PublicFlightSearchResult>(
    `/api/flights/search?${query.toString()}`,
  );
}

export async function getPublicFlight(
  id: number,
): Promise<{ item: PublicFlight }> {
  return api<{ item: PublicFlight }>(`/api/flights/${id}`);
}

// ===== BOOKING =====

export type BookingPassengerInput = {
  fullName: string;
  documentNumber: string;
  gender: "MALE" | "FEMALE";
  dateOfBirth: string;
  nationality: string;
};

export type CreateBookingInput = {
  flightId: number
  returnFlightId?: number
  contactName: string
  contactEmail: string
  contactPhone: string
  passengers: BookingPassengerInput[]
}

export type CreatedBooking = {
  bookingCode: string
  totalAmount: number
  outboundUnitPrice?: number | null
  returnUnitPrice?: number | null
  status: string
  expiresAt: string
}

export async function createBooking(
  input: CreateBookingInput,
): Promise<{ message: string; item: CreatedBooking }> {
  return api<{ message: string; item: CreatedBooking }>(
    "/api/bookings",
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
}

export async function payBooking(
  bookingCode: string,
): Promise<Record<string, unknown>> {
  return api<Record<string, unknown>>(
    `/api/bookings/${encodeURIComponent(bookingCode)}/pay`,
    {
      method: "POST",
    },
  );
}

export type VietQrPayment = {
  bookingCode: string;
  amount: number;
  currency: "VND";
  bankId: string;
  accountNo: string;
  accountName: string;
  transferContent: string;
  imageUrl: string;
  expiresAt: string | null;
};

export async function getBookingPaymentQr(bookingCode: string): Promise<{ item: VietQrPayment }> {
  return api<{ item: VietQrPayment }>(
    `/api/bookings/${encodeURIComponent(bookingCode)}/payment-qr`,
  );
}

// ===== BOOKING DETAILS =====

export type BookingTicket = {
  ticketCode: string;
  qrToken: string;
  price: number;
  status: string;
  issuedAt: string;
};

export type BookingDetails = {
  bookingCode: string
  flightId: number
  returnFlightId: number | null
  outboundUnitPrice: number | null
  returnUnitPrice: number | null
  contactName: string
  contactEmail: string | null
  contactPhone: string | null
  totalAmount: number
  status: string
  expiresAt: string
  createdAt: string
  flight: {
    flightNumber: string;
    departureCode: string;
    arrivalCode: string;
    departureTime: string;
    arrivalTime: string;
    basePrice: number;
    airline: {
      code: string
      name: string
    }
  }
  returnFlight: BookingDetails['flight'] | null
  passengers: Array<{
    id: number
    fullName: string
    ticket: {
      ticketCode: string
      flightId: number
      qrToken: string
      price: number
      status: string
      issuedAt: string
    } | null
    tickets: Array<{
      ticketCode: string
      flightId: number
      qrToken: string
      price: number
      status: string
      issuedAt: string
    }>
  }>
  payments: Array<{
    amount: number;
    currency: string;
    method: string;
    status: string;
    createdAt: string;
  }>;
};

export async function getBookingByCode(
  bookingCode: string,
): Promise<{ item: BookingDetails }> {
  return api<{ item: BookingDetails }>(
    `/api/bookings/${encodeURIComponent(bookingCode)}`,
  );
}

// ===== PUBLIC TICKET QR VERIFICATION =====

export type TicketVerification = {
  valid: boolean;
  ticket: {
    ticketCode: string;
    status: string;
    issuedAt: string;
    usedAt: string | null;
  };
  passenger: {
    fullName: string;
  };
  booking: {
    status: string;
  };
  flight: {
    flightNumber: string;
    departureCode: string;
    arrivalCode: string;
    departureTime: string;
    status: string;
    airlineCode: string;
    airlineName: string;
  };
  message: string;
};

export async function verifyPublicTicket(
  token: string,
): Promise<{ item: TicketVerification }> {
  return api<{ item: TicketVerification }>(
    `/api/public/tickets/verify/${encodeURIComponent(token)}`,
  );
}
