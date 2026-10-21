export type AirlineFlight = {
  id: number; flightNumber: string; departureCode: string; arrivalCode: string;
  departureTime: string; arrivalTime: string; capacity: number; basePrice: number;
  status: string; saleStatus: 'ON_SALE' | 'HIDDEN'; createdAt: string;
  confirmedSeats: number; heldSeats: number; availableSeats: number; occupancyPercent: number;
  confirmedBookings: number; simulatedRevenue: number; currentPrice: number | null;
}
export type AirlineWorkspace = {
  airline: { id: number; code: string; name: string; status: string }
  items: AirlineFlight[]
  summary: { flights: number; onSaleFlights: number; confirmedSeats: number; capacity: number; simulatedRevenue: number }
  pagination: { page: number; pageSize: number; total: number; pageCount: number }
}

export type DashboardMetric = { ticketsSold: number; paidBookings: number; revenue: number }
export type DashboardPoint = DashboardMetric & { date: string }
export type AirlineDashboard = {
  summary: DashboardMetric & { flights: number; onSaleFlights: number; capacity: number; occupancyPercent: number }
  flights: Array<DashboardMetric & { id: number; flightNumber: string; departureCode: string; arrivalCode: string;
    departureTime: string; capacity: number; basePrice: number; status: string; saleStatus: 'ON_SALE' | 'HIDDEN'; occupancyPercent: number }>
  departureSeries: DashboardPoint[]
  routes: Array<DashboardMetric & { departureCode: string; arrivalCode: string; flights: number }>
  salesSeriesByFlight: Record<string, DashboardPoint[]>
}

async function request<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const response = await fetch(path, { method, credentials: 'same-origin',
    headers: { ...(method === 'GET' ? {} : { 'x-csrf-intent': '1' }), ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }) })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.error || `Yêu cầu thất bại (HTTP ${response.status}).`)
  return data as T
}

export const getAirlineWorkspace = (params: URLSearchParams) => request<AirlineWorkspace>(`/api/airline/workspace?${params}`)
export const getAirlineDashboard = (params: URLSearchParams) => request<AirlineDashboard>(`/api/airline/dashboard?${params}`)
export const createAirlineFlight = (input: { flightNumber: string; departureCode: string; arrivalCode: string; departureTime: string; arrivalTime: string }) =>
  request<{ id: number }>('/api/airline/managed-flights', 'POST', input)
export const saveAirlineSalesSettings = (flightId: number, capacity: number, basePrice: number) =>
  request(`/api/airline/flights/${flightId}/sales-settings`, 'PUT', { capacity, basePrice })
export const updateAirlineSaleStatus = (flightId: number, saleStatus: 'ON_SALE' | 'HIDDEN') =>
  request(`/api/airline/flights/${flightId}/sale-status`, 'PUT', { saleStatus })
