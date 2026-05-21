import { CONTACT_EMAIL } from '../../lib/creditor'

export default function AppFooter() {
  return (
    <footer className="relative bg-black border-t border-white/[0.08] mt-auto">
      <div className="max-w-6xl mx-auto px-6 md:px-12 py-8 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2.5 text-[12px] text-white/45 font-light">
          <span className="font-medium text-white/75 tracking-tight">Swiss Arena</span>
          <span className="text-white/20">·</span>
          <span>Designed in Switzerland</span>
        </div>
        <div className="flex items-center justify-center gap-x-4 gap-y-2 flex-wrap text-[12px] text-white/45 font-light">
          <a href="/" className="hover:text-white/80 transition-colors duration-300">
            Accueil
          </a>
          <span className="text-white/20">·</span>
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="hover:text-white/80 transition-colors duration-300"
          >
            {CONTACT_EMAIL}
          </a>
        </div>
      </div>
    </footer>
  )
}
