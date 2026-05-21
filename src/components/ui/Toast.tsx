import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { Check } from 'lucide-react'

interface ToastItem {
  id: number
  message: string
}

interface ToastCtx {
  toast: (message: string) => void
}

const ToastContext = createContext<ToastCtx | null>(null)

export function useToast(): ToastCtx {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])

  const toast = useCallback((message: string) => {
    const id = Date.now() + Math.random()
    setItems((prev) => [...prev, { id, message }])
    window.setTimeout(() => {
      setItems((prev) => prev.filter((t) => t.id !== id))
    }, 3000)
  }, [])

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] flex flex-col items-center gap-2 pointer-events-none">
        {items.map((t) => (
          <div
            key={t.id}
            className="glass-pill rounded-full px-5 py-3 flex items-center gap-2.5 animate-toast-in"
          >
            <span className="h-5 w-5 rounded-full bg-emerald-500/20 flex items-center justify-center">
              <Check className="h-3 w-3 text-emerald-400" strokeWidth={2.5} />
            </span>
            <span className="text-[13px] font-light text-white/85">{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
