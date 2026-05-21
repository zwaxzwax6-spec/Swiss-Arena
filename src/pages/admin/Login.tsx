import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import GlassCard from '../../components/ui/GlassCard'
import Input from '../../components/ui/Input'
import Button from '../../components/ui/Button'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'

export default function Login() {
  const navigate = useNavigate()
  const { session, loading } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!loading && session) navigate('/admin/dashboard', { replace: true })
  }, [session, loading, navigate])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password })
    setSubmitting(false)
    if (authError) {
      setError('Identifiants incorrects.')
      return
    }
    navigate('/admin/dashboard', { replace: true })
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-5 bg-black">
      <img src="/LogoSwiss.png" alt="Swiss Arena" className="h-10 w-auto mb-10" />
      <GlassCard className="w-full max-w-[400px] p-8">
        <h1 className="text-[24px] font-extralight text-white mb-7 text-center">Administration</h1>
        <form onSubmit={handleSubmit} noValidate>
          <div className="mb-4">
            <Input
              label="Email"
              name="email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="mb-6">
            <Input
              label="Mot de passe"
              name="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {error && (
            <p className="text-red-400/80 text-[13px] font-light mb-4 text-center">{error}</p>
          )}
          <Button type="submit" loading={submitting} className="w-full">
            Connexion
          </Button>
        </form>
      </GlassCard>
    </div>
  )
}
