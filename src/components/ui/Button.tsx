import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { ArrowRight, Loader2 } from 'lucide-react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'premium' | 'ghost' | 'danger'
  loading?: boolean
  withArrow?: boolean
  children: ReactNode
}

export default function Button({
  variant = 'premium',
  loading = false,
  withArrow = false,
  className = '',
  children,
  disabled,
  ...rest
}: ButtonProps) {
  if (variant === 'premium') {
    return (
      <button
        className={`cta-premium group rounded-full py-3.5 px-7 inline-flex items-center justify-center gap-3 text-[15px] font-medium ${className}`}
        disabled={disabled || loading}
        {...rest}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <>
            <span>{children}</span>
            {withArrow && (
              <span className="h-7 w-7 rounded-full bg-black flex items-center justify-center group-hover:translate-x-0.5 transition-transform duration-500">
                <ArrowRight className="h-3.5 w-3.5 text-white" strokeWidth={2.5} />
              </span>
            )}
          </>
        )}
      </button>
    )
  }

  const base =
    'rounded-full py-3 px-6 inline-flex items-center justify-center gap-2 text-[14px] font-light transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed'
  const styles =
    variant === 'danger'
      ? 'bg-red-500/15 text-red-300 border border-red-500/25 hover:bg-red-500/25'
      : 'bg-white/[0.04] text-white/70 border border-white/12 hover:bg-white/[0.08] hover:text-white'

  return (
    <button className={`${base} ${styles} ${className}`} disabled={disabled || loading} {...rest}>
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : children}
    </button>
  )
}
