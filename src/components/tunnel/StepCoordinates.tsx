import { useRef, useState } from 'react'
import Input from '../ui/Input'
import Select from '../ui/Select'
import Button from '../ui/Button'
import GlassCard from '../ui/GlassCard'
import { CANTONS } from '../../lib/cantons'
import { isValidSwissPostalCode } from '../../hooks/usePostalCode'
import { lookupPostalCode } from '../../lib/postal-codes'
import type { FormErrors, OrderForm } from './types'

const CANTON_OPTIONS = CANTONS.map((c) => ({ value: c.code, label: `${c.code} — ${c.name}` }))

interface Props {
  form: OrderForm
  errors: FormErrors
  onChange: (field: keyof OrderForm, value: string) => void
  onContinue: () => void
}

export default function StepCoordinates({ form, errors, onChange, onContinue }: Props) {
  const [flash, setFlash] = useState<{ city?: boolean; canton?: boolean }>({})
  const flashTimer = useRef<number>()

  function handlePostal(value: string) {
    const cleaned = value.replace(/\D/g, '').slice(0, 4)
    onChange('postalCode', cleaned)
    if (isValidSwissPostalCode(cleaned)) {
      const match = lookupPostalCode(cleaned)[0]
      if (match) {
        onChange('city', match.city)
        onChange('canton', match.canton)
        window.clearTimeout(flashTimer.current)
        setFlash({ city: true, canton: true })
        flashTimer.current = window.setTimeout(() => setFlash({}), 950)
      }
    }
  }

  return (
    <GlassCard className="w-full max-w-[560px] mx-auto p-6 md:p-9">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          onContinue()
        }}
        noValidate
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <Input
            label="Prénom"
            name="firstName"
            autoComplete="given-name"
            value={form.firstName}
            error={errors.firstName}
            onChange={(e) => onChange('firstName', e.target.value)}
          />
          <Input
            label="Nom"
            name="lastName"
            autoComplete="family-name"
            value={form.lastName}
            error={errors.lastName}
            onChange={(e) => onChange('lastName', e.target.value)}
          />
        </div>

        <div className="mb-4">
          <Input
            label="Email"
            name="email"
            type="email"
            autoComplete="email"
            value={form.email}
            error={errors.email}
            onChange={(e) => onChange('email', e.target.value)}
          />
        </div>

        <div className="mb-4">
          <Input
            label="Téléphone"
            name="phone"
            type="tel"
            autoComplete="tel"
            placeholder="+41 79 000 00 00"
            value={form.phone}
            error={errors.phone}
            onChange={(e) => onChange('phone', e.target.value)}
          />
        </div>

        <div className="mb-4">
          <Input
            label="Entreprise"
            name="companyName"
            optional
            autoComplete="organization"
            value={form.companyName}
            onChange={(e) => onChange('companyName', e.target.value)}
          />
        </div>

        <div className="mb-4">
          <Input
            label="Lien de votre fiche Google *"
            name="googleBusinessUrl"
            type="url"
            inputMode="url"
            placeholder="https://g.page/votre-etablissement"
            value={form.googleBusinessUrl}
            error={errors.googleBusinessUrl}
            onChange={(e) => onChange('googleBusinessUrl', e.target.value)}
          />
          <span className="mt-1.5 block text-[12px] text-white/35 font-light">
            Cherchez votre établissement sur Google Maps, puis copiez le lien de partage
          </span>
        </div>

        <div className="mb-4">
          <Input
            label="Adresse"
            name="address"
            autoComplete="street-address"
            value={form.address}
            error={errors.address}
            onChange={(e) => onChange('address', e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-[100px_1fr_1.4fr] gap-4 mb-8">
          <Input
            label="NPA"
            name="postalCode"
            inputMode="numeric"
            autoComplete="postal-code"
            value={form.postalCode}
            error={errors.postalCode}
            onChange={(e) => handlePostal(e.target.value)}
          />
          <Input
            label="Ville"
            name="city"
            autoComplete="address-level2"
            value={form.city}
            error={errors.city}
            flash={flash.city}
            onChange={(e) => onChange('city', e.target.value)}
          />
          <div className="col-span-2 md:col-span-1">
            <Select
              label="Canton"
              name="canton"
              placeholder="Canton"
              value={form.canton}
              error={errors.canton}
              flash={flash.canton}
              options={CANTON_OPTIONS}
              onChange={(e) => onChange('canton', e.target.value)}
            />
          </div>
        </div>

        <Button type="submit" withArrow className="w-full">
          Continuer
        </Button>
      </form>
    </GlassCard>
  )
}
