import AppNavBar from '../components/layout/AppNavBar'
import Button from '../components/ui/Button'

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col bg-black">
      <AppNavBar secure={false} />
      <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
        <div className="text-[84px] font-extralight headline-glow leading-none">404</div>
        <p className="mt-4 text-white/55 font-light">Cette page n'existe pas.</p>
        <a href="/" className="mt-8">
          <Button variant="ghost">Retour à l'accueil</Button>
        </a>
      </div>
    </div>
  )
}
