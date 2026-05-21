import { Search, Download } from 'lucide-react'
import Select from '../ui/Select'
import { STATUS_LABELS, type OrderStatus } from '../../lib/types'

export type SortKey = 'date_desc' | 'date_asc' | 'due_asc' | 'amount_desc'
export type StatusFilter = OrderStatus | 'all'

const STATUS_OPTIONS = [
  { value: 'all', label: 'Tous les statuts' },
  ...(Object.keys(STATUS_LABELS) as OrderStatus[]).map((s) => ({ value: s, label: STATUS_LABELS[s] })),
]

const SORT_OPTIONS = [
  { value: 'date_desc', label: 'Date (récent)' },
  { value: 'date_asc', label: 'Date (ancien)' },
  { value: 'due_asc', label: 'Échéance (urgent)' },
  { value: 'amount_desc', label: 'Montant' },
]

interface Props {
  status: StatusFilter
  onStatus: (s: StatusFilter) => void
  search: string
  onSearch: (s: string) => void
  sort: SortKey
  onSort: (s: SortKey) => void
  onExport: () => void
}

export default function FilterBar({
  status,
  onStatus,
  search,
  onSearch,
  sort,
  onSort,
  onExport,
}: Props) {
  return (
    <div className="flex flex-col md:flex-row md:items-end gap-3 mb-6">
      <div className="md:w-52">
        <Select
          options={STATUS_OPTIONS}
          value={status}
          onChange={(e) => onStatus(e.target.value as StatusFilter)}
        />
      </div>

      <div className="flex-1 relative">
        <Search className="h-4 w-4 text-white/40 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          className="field-input pl-11"
          placeholder="Rechercher par nom, email ou référence..."
          value={search}
          onChange={(e) => onSearch(e.target.value)}
        />
      </div>

      <div className="md:w-48">
        <Select options={SORT_OPTIONS} value={sort} onChange={(e) => onSort(e.target.value as SortKey)} />
      </div>

      <button
        onClick={onExport}
        className="rounded-full py-3 px-5 inline-flex items-center justify-center gap-2 text-[13px] font-light bg-white/[0.04] text-white/70 border border-white/12 hover:bg-white/[0.08] hover:text-white transition-all duration-300 shrink-0"
      >
        <Download className="h-4 w-4" />
        Exporter
      </button>
    </div>
  )
}
