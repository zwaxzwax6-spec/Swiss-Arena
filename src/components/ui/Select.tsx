import { forwardRef, type SelectHTMLAttributes } from 'react'
import { ChevronDown } from 'lucide-react'

interface Option {
  value: string
  label: string
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
  flash?: boolean
  options: Option[]
  placeholder?: string
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, error, flash, options, placeholder, className = '', id, ...rest },
  ref,
) {
  const selectId = id ?? rest.name
  return (
    <div className="flex flex-col">
      {label && (
        <label htmlFor={selectId} className="text-[12px] font-light text-white/55 mb-2">
          {label}
        </label>
      )}
      <div className="relative">
        <select
          ref={ref}
          id={selectId}
          className={`field-input appearance-none pr-10 cursor-pointer ${error ? 'field-error' : ''} ${flash ? 'field-flash' : ''} ${className}`}
          aria-invalid={!!error}
          {...rest}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <ChevronDown className="h-4 w-4 text-white/40 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
      </div>
      {error && <span className="text-red-400/80 text-[13px] font-light mt-1.5">{error}</span>}
    </div>
  )
})

export default Select
