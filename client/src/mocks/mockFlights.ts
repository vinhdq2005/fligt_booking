export type Flight = {
  id: string
  airline: string
  flightNumber: string
  from: string
  to: string
  departureTime: string
  arrivalTime: string
  duration: string
  price: number
  availableSeats: number
}

export const mockFlights: Flight[] = [
  {
    id: 'flight-001',
    airline: 'Vietnam Airlines',
    flightNumber: 'VN123',
    from: 'HAN',
    to: 'SGN',
    departureTime: '07:00',
    arrivalTime: '09:10',
    duration: '2 giờ 10 phút',
    price: 1500000,
    availableSeats: 25,
  },
  {
    id: 'flight-002',
    airline: 'Vietjet Air',
    flightNumber: 'VJ201',
    from: 'HAN',
    to: 'SGN',
    departureTime: '10:30',
    arrivalTime: '12:40',
    duration: '2 giờ 10 phút',
    price: 1200000,
    availableSeats: 18,
  },
  {
    id: 'flight-003',
    airline: 'Bamboo Airways',
    flightNumber: 'QH105',
    from: 'HAN',
    to: 'DAD',
    departureTime: '08:15',
    arrivalTime: '09:35',
    duration: '1 giờ 20 phút',
    price: 950000,
    availableSeats: 12,
  },
  {
    id: 'flight-004',
    airline: 'Vietnam Airlines',
    flightNumber: 'VN115',
    from: 'SGN',
    to: 'DAD',
    departureTime: '14:00',
    arrivalTime: '15:20',
    duration: '1 giờ 20 phút',
    price: 1100000,
    availableSeats: 20,
  },
  {
    id: 'flight-005',
    airline: 'Vietjet Air',
    flightNumber: 'VJ305',
    from: 'HPH',
    to: 'SGN',
    departureTime: '16:30',
    arrivalTime: '18:40',
    duration: '2 giờ 10 phút',
    price: 1350000,
    availableSeats: 8,
  },
]