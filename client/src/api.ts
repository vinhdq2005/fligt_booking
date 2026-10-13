
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
    headers: {
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
  }>(
    "/api/admin/flight-imports",
    {
      method: "POST",
      body: JSON.stringify({
        ...form,
        confirmed: true,
      }),
    },
  );
}

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
  status: string;
  airline: {
    id: number;
    code: string;
    name: string;
  };
};

export type PublicFlightSearchResult = {
  items: PublicFlight[];
  total: number;
};

export async function searchPublicFlights(filters: {
  from: string;
  to: string;
  date: string;
}): Promise<PublicFlightSearchResult> {
  const query = new URLSearchParams({
    from: filters.from,
    to: filters.to,
    date: filters.date,
  });

  return api<PublicFlightSearchResult>(
    `/api/flights/search?${query.toString()}`,
  );
}

export async function getPublicFlight(
  id: number,
): Promise<{ item: PublicFlight }> {
  return api<{ item: PublicFlight }>(
    `/api/flights/${id}`,
  );
}