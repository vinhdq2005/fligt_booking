import type { Role } from './authApi'

export function getRoleLanding(role: Role): string {
  switch (role) {
    case 'ADMIN':
      return '/admin'
    case 'AIRLINE_FLIGHT_MANAGER':
      return '/airline/flights'
    case 'AIRLINE_SALES_MANAGER':
      return '/airline/dashboard'
    case 'CUSTOMER':
      return '/'
  }
}

export function getRoleLabel(role: Role): string {
  switch (role) {
    case 'ADMIN':
      return 'Quản trị viên'
    case 'AIRLINE_FLIGHT_MANAGER':
      return 'Quản lý chuyến bay'
    case 'AIRLINE_SALES_MANAGER':
      return 'Quản lý bán vé'
    case 'CUSTOMER':
      return 'Khách hàng'
  }
}
