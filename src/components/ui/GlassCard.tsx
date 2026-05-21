import type { HTMLAttributes } from 'react'

type Variant = 'glass' | 'offer' | 'stat'

interface GlassCardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: Variant
  hover?: boolean
  premium?: boolean
}

const VARIANT_CLASS: Record<Variant, string> = {
  glass: 'card-glass',
  offer: 'offer-card',
  stat: 'stat-glass',
}

export default function GlassCard({
  variant = 'glass',
  hover = false,
  premium = false,
  className = '',
  children,
  ...rest
}: GlassCardProps) {
  const radius = premium ? 'rounded-card-lg' : 'rounded-card'
  const hoverClass = hover ? 'card-glass-hover' : ''
  return (
    <div className={`${VARIANT_CLASS[variant]} ${radius} ${hoverClass} ${className}`} {...rest}>
      {children}
    </div>
  )
}
