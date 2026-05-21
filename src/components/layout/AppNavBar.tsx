import { Lock } from 'lucide-react'

export default function AppNavBar({ secure = true }: { secure?: boolean }) {
  return (
    <nav className="sticky top-0 z-40 glass-pill border-0 border-b border-white/[0.08] rounded-none">
      <div className="max-w-6xl mx-auto flex items-center justify-between px-5 md:px-10 py-4">
        <a href="/" aria-label="Swiss Arena — accueil">
          <img src="/LogoSwiss.png" alt="Swiss Arena" className="h-8 w-auto" />
        </a>
        {secure && (
          <div className="flex items-center gap-2 text-white/55">
            <Lock className="h-3.5 w-3.5" />
            <span className="text-[12px] font-light tracking-tight">Commande sécurisée</span>
          </div>
        )}
      </div>
    </nav>
  )
}
