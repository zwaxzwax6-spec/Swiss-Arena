import { Check } from 'lucide-react'
import type { TunnelStep } from './types'

const STEPS = ['Coordonnées', 'Paiement', 'Confirmation']

interface StepperProps {
  current: TunnelStep
  maxReached: TunnelStep
  onStepClick: (step: TunnelStep) => void
}

export default function Stepper({ current, maxReached, onStepClick }: StepperProps) {
  const progress = (current / (STEPS.length - 1)) * 100

  return (
    <div className="relative w-full max-w-[560px] mx-auto mb-10 md:mb-14">
      {/* progress rail */}
      <div className="absolute top-4 left-0 right-0 h-px bg-white/10" />
      <div
        className="absolute top-4 left-0 h-px transition-all duration-700 ease-premium"
        style={{
          width: `${progress}%`,
          background: 'linear-gradient(90deg, rgba(160,210,255,0.5), rgba(160,210,255,0.8))',
          boxShadow: '0 0 12px rgba(160,210,255,0.4)',
        }}
      />

      <div className="relative flex items-start justify-between">
        {STEPS.map((label, i) => {
          const idx = i as TunnelStep
          const completed = idx < current
          const active = idx === current
          const clickable = idx <= maxReached && idx !== current
          return (
            <button
              key={label}
              type="button"
              disabled={!clickable}
              onClick={() => clickable && onStepClick(idx)}
              className={`flex flex-col items-center gap-2.5 ${clickable ? 'cursor-pointer group' : 'cursor-default'}`}
              style={{ flex: '0 0 auto' }}
            >
              <span
                className={`h-8 w-8 rounded-full flex items-center justify-center text-[12px] font-medium transition-all duration-500 ease-premium ${
                  active
                    ? 'bg-white text-black'
                    : completed
                      ? 'bg-white/20 text-white group-hover:bg-white/30'
                      : 'bg-white/5 text-white/30'
                }`}
              >
                {completed ? <Check className="h-3.5 w-3.5" strokeWidth={2.5} /> : `0${i + 1}`}
              </span>
              <span
                className={`text-[10px] md:text-[11px] tracking-[0.15em] uppercase font-light transition-colors ${
                  active ? 'text-white/80' : 'text-white/35'
                }`}
              >
                {label}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
