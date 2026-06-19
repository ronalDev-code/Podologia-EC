'use client'

import { useState, useEffect } from 'react'
import { signInWithEmailAndPassword } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { useRouter } from 'next/navigation'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [nombreConsultorio, setNombreConsultorio] = useState(
    'Centro Podológico Erika Correa'
  )

  useEffect(() => {
    getDoc(doc(db, 'config', 'consultorio')).then(snap => {
      if (snap.exists()) {
        const data = snap.data()
        if (data.logoUrl) setLogoUrl(data.logoUrl)
        if (data.nombre) setNombreConsultorio(data.nombre)
      }
    })
  }, [])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await signInWithEmailAndPassword(auth, email, password)
      router.push('/pacientes')
    } catch {
      setError('Correo o contraseña incorrectos')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col
      items-center justify-center px-4">

      <div className="w-full max-w-sm bg-white rounded-2xl
        shadow-sm border border-gray-100 p-8">

        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-24 h-24 rounded-full bg-primary-50
            flex items-center justify-center mb-3 overflow-hidden
            border-2 border-primary-100">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt="Logo consultorio"
                className="w-full h-full object-cover"
              />
            ) : (
              <svg width="44" height="44" viewBox="0 0 24 24"
                fill="none">
                <ellipse cx="12" cy="8" rx="5" ry="6"
                  stroke="#0F6E56" strokeWidth="1.5"/>
                <path d="M7 13 Q4 17 7 20 Q10 22 12 20
                  Q14 22 17 20 Q20 17 17 13"
                  stroke="#0F6E56" strokeWidth="1.5" fill="none"/>
              </svg>
            )}
          </div>
          <h1 className="text-lg font-semibold text-gray-800
            text-center leading-tight">
            Erika Correa
          </h1>
          <p className="text-sm text-primary-600 font-medium
            tracking-wide text-center">
            {nombreConsultorio.toUpperCase()}
          </p>
        </div>

        {/* Formulario */}
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium
              text-gray-700 mb-1">
              Correo electrónico
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              placeholder="correo@ejemplo.com"
              className="w-full px-3 py-2.5 rounded-lg border
                border-gray-200 text-sm focus:outline-none
                focus:ring-2 focus:ring-primary-500
                focus:border-transparent placeholder:text-gray-400
                transition"
            />
          </div>

          <div>
            <label className="block text-sm font-medium
              text-gray-700 mb-1">
              Contraseña
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="w-full px-3 py-2.5 pr-10 rounded-lg
                  border border-gray-200 text-sm focus:outline-none
                  focus:ring-2 focus:ring-primary-500
                  focus:border-transparent placeholder:text-gray-400
                  transition"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2
                  text-gray-400 hover:text-gray-600 transition-colors"
                aria-label={showPassword
                  ? 'Ocultar contraseña'
                  : 'Mostrar contraseña'}
              >
                {showPassword ? (
                  // Ojo tachado
                  <svg width="18" height="18" viewBox="0 0 24 24"
                    fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M17.94 17.94A10.07 10.07 0 0112 20
                      c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94
                      M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8
                      a18.5 18.5 0 01-2.16 3.19m-6.72-1.07
                      a3 3 0 11-4.24-4.24"/>
                    <line x1="1" y1="1" x2="23" y2="23"/>
                  </svg>
                ) : (
                  // Ojo abierto
                  <svg width="18" height="18" viewBox="0 0 24 24"
                    fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11
                      8-11-8-11-8z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                )}
              </button>
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-500 text-center
              bg-red-50 rounded-lg py-2 px-3">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary-600 hover:bg-primary-700
              disabled:bg-primary-300 text-white font-medium
              py-2.5 rounded-lg text-sm transition"
          >
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>

        <p className="text-center text-xs text-gray-400 mt-6">
          Sistema de Historia Clínica v1.0
        </p>
      </div>

      <p className="text-xs text-gray-400 mt-4">
        Desarrollado por{' '}
        <span className="font-medium text-gray-500">RonalDev</span>
      </p>
    </div>
  )
}