import Badge from '../ui/Badge'
import { STATUS_BADGE, STATUS_LABELS, type OrderStatus } from '../../lib/types'

export default function StatusBadge({ status }: { status: OrderStatus }) {
  return <Badge className={STATUS_BADGE[status]}>{STATUS_LABELS[status]}</Badge>
}
