import { forwardRef, type InputHTMLAttributes } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  error?: string
  flash?: boolean
  optional?: boolean
}

const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, flash, optional, className = '', id, ...rest },
  ref,
) {
  const inputId = id ?? rest.name
  return (
    <div className="flex flex-col">
      <label htmlFor={inputId} className="text-[12px] font-light text-white/55 mb-2">
        {label}
        {optional && <span className="text-white/30"> (optionnel)</span>}
      </label>
      <input
        ref={ref}
        id={inputId}
        className={`field-input ${error ? 'field-error' : ''} ${flash ? 'field-flash' : ''} ${className}`}
        aria-invalid={!!error}
        {...rest}
      />
      {error && <span className="text-red-400/80 text-[13px] font-light mt-1.5">{error}</span>}
    </div>
  )
})

export default Input
