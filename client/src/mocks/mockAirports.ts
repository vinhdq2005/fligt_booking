export type Airport = {
  id: string
  code: string
  name: string
  city: string
}

export const mockAirports: Airport[] = [
  {
    id: 'airport-han',
    code: 'HAN',
    name: 'Sân bay Quốc tế Nội Bài',
    city: 'Hà Nội',
  },
  {
    id: 'airport-sgn',
    code: 'SGN',
    name: 'Sân bay Quốc tế Tân Sơn Nhất',
    city: 'TP. Hồ Chí Minh',
  },
  {
    id: 'airport-dad',
    code: 'DAD',
    name: 'Sân bay Quốc tế Đà Nẵng',
    city: 'Đà Nẵng',
  },
  {
    id: 'airport-hph',
    code: 'HPH',
    name: 'Sân bay Quốc tế Cát Bi',
    city: 'Hải Phòng',
  },
  {
    id: 'airport-pqc',
    code: 'PQC',
    name: 'Sân bay Phú Quốc',
    city: 'Phú Quốc',
  },
]
