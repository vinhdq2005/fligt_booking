export type Role = 'ADMIN' | 'CUSTOMER' | 'AIRLINE_FLIGHT_MANAGER' | 'AIRLINE_SALES_MANAGER'
export type CurrentUser = {
  id: number
  name: string
  email: string
  role: Role
  airlineId: number | null
  phone: string | null
}

async function request<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const response = await fetch(path, {
    method,
    credentials: 'same-origin',
    headers: {
      ...(method === 'GET' ? {} : { 'x-csrf-intent': '1' }),
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
  if (response.status === 204) return undefined as T
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.error || `Yêu cầu thất bại (HTTP ${response.status}).`)
  return data as T
}

export const getMe = () => request<{ user: CurrentUser }>('/api/auth/me')
export const login = (email: string, password: string) => request<{ user: CurrentUser }>('/api/auth/login', 'POST', { email, password })
export const register = (name: string, email: string, password: string) => request<{ user: CurrentUser }>('/api/auth/register', 'POST', { name, email, password })
export const logout = () => request<void>('/api/auth/logout', 'POST')
export const updateProfile = (name: string, phone: string) => request<{ user: CurrentUser }>('/api/auth/me', 'PATCH', { name, phone })
