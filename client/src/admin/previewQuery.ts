import type { CatalogRow } from './previewCatalog'

export type PreviewQuery = {
  search: string
  choices: Record<string, string>
  dates: Record<string, string>
  fromDate: string
  toDate: string
  sortIndex: number | null
  sortDirection: 'asc' | 'desc'
  page: number
  pageSize: number
}

export const initialPreviewQuery: PreviewQuery = {
  search: '', choices: {}, dates: {}, fromDate: '', toDate: '',
  sortIndex: null, sortDirection: 'asc', page: 1, pageSize: 2,
}

function normalized(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('vi-VN').replace(/đ/g, 'd')
}

export function queryPreviewRows(rows: CatalogRow[], query: PreviewQuery) {
  const term = normalized(query.search.trim())
  const filtered = rows.filter((row) => {
    if (term && !normalized(row.searchText).includes(term)) return false
    if (Object.entries(query.choices).some(([key, value]) => value && row.filters[key] !== value)) return false
    if (Object.entries(query.dates).some(([key, value]) => value && row.filters[key] !== value)) return false
    if (query.fromDate && (!row.rangeDate || row.rangeDate < query.fromDate)) return false
    if (query.toDate && (!row.rangeDate || row.rangeDate > query.toDate)) return false
    return true
  })

  if (query.sortIndex !== null) {
    const index = query.sortIndex
    const direction = query.sortDirection === 'asc' ? 1 : -1
    filtered.sort((a, b) => {
      const left = a.sortValues[index]
      const right = b.sortValues[index]
      const comparison = typeof left === 'number' && typeof right === 'number'
        ? left - right
        : String(left ?? '').localeCompare(String(right ?? ''), 'vi-VN', { numeric: true })
      return comparison * direction
    })
  }

  const pageSize = Math.max(1, Math.floor(query.pageSize))
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize))
  const page = Math.min(Math.max(1, query.page), pageCount)
  const start = (page - 1) * pageSize
  return {
    items: filtered.slice(start, start + pageSize),
    total: filtered.length,
    page,
    pageSize,
    pageCount,
    start: filtered.length ? start + 1 : 0,
    end: Math.min(start + pageSize, filtered.length),
  }
}
