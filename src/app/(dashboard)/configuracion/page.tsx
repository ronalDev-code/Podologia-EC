'use client'

import { useState, useEffect } from 'react'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import {
  updatePassword, reauthenticateWithCredential,
  EmailAuthProvider
} from 'firebase/auth'
import { useAuth } from '@/lib/auth-context'

interface Config {
  nombre: string
  telefono: string
  direccion: string
  logoUrl: string | null
}

export default function ConfiguracionPage() {
  const { user } = useAuth()
  const [config, setConfig] = useState<Config>({
    nombre: 'Centro Podológico Erika Correa',
    telefono: '',
    direccion: '',
    logoUrl: null,
  })
  const [loading, setLoading] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [subiendoLogo, setSubiendoLogo] = useState(false)
  const [exito, setExito] = useState('')
  const [error, setError] = useState('')

  // Cambio de contraseña
  const [passActual, setPassActual] = useState('')
  const [passNueva, setPassNueva] = useState('')
  const [passConfirmar, setPassConfirmar] = useState('')
  const [showPassActual, setShowPassActual] = useState(false)
  const [showPassNueva, setShowPassNueva] = useState(false)
  const [cambiandoPass, setCambiandoPass] = useState(false)
  const [exitoPass, setExitoPass] = useState('')
  const [errorPass, setErrorPass] = useState('')

  useEffect(() => {
    async function cargar() {
      try {
        const snap = await getDoc(doc(db, 'config', 'consultorio'))
        if (snap.exists()) setConfig(snap.data() as Config)
      } finally {
        setLoading(false)
      }
    }
    cargar()
  }, [])

  async function subirLogo(file: File) {
    setSubiendoLogo(true)
    setError('')
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('pacienteId', 'config')
      formData.append('tipo', 'logo')
      const res = await fetch('/api/fotos', {
        method: 'POST', body: formData,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setConfig(prev => ({ ...prev, logoUrl: data.url }))
    } catch {
      setError('Error al subir el logo')
    } finally {
      setSubiendoLogo(false)
    }
  }

  async function guardar() {
    setGuardando(true)
    setError('')
    try {
      await setDoc(doc(db, 'config', 'consultorio'), config)
      setExito('Configuración guardada correctamente')
      setTimeout(() => setExito(''), 3000)
    } catch {
      setError('Error al guardar configuración')
    } finally {
      setGuardando(false)
    }
  }

  async function cambiarPassword() {
    setErrorPass('')
    if (!passActual || !passNueva || !passConfirmar) {
      setErrorPass('Todos los campos son obligatorios')
      return
    }
    if (passNueva.length < 6) {
      setErrorPass('La nueva contraseña debe tener al menos 6 caracteres')
      return
    }
    if (passNueva !== passConfirmar) {
      setErrorPass('Las contraseñas nuevas no coinciden')
      return
    }
    if (!user?.email) return

    setCambiandoPass(true)
    try {
      // Reautenticar antes de cambiar contraseña
      const credential = EmailAuthProvider.credential(
        user.email, passActual
      )
      await reauthenticateWithCredential(user, credential)
      await updatePassword(user, passNueva)
      setExitoPass('Contraseña actualizada correctamente')
      setPassActual('')
      setPassNueva('')
      setPassConfirmar('')
      setTimeout(() => setExitoPass(''), 4000)
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code
      if (code === 'auth/wrong-password' ||
          code === 'auth/invalid-credential') {
        setErrorPass('La contraseña actual es incorrecta')
      } else {
        setErrorPass('Error al cambiar la contraseña')
      }
    } finally {
      setCambiandoPass(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-2 border-primary-600
          border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">

      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-800">
          Configuración
        </h1>
        <p className="text-sm text-gray-500">
          Datos del consultorio y seguridad
        </p>
      </div>

      {exito && (
        <div className="bg-green-50 border border-green-100
          rounded-xl p-3 mb-4 text-sm text-green-700 font-medium">
          ✓ {exito}
        </div>
      )}

      <div className="space-y-4">

        {/* LOGO */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">
            Logo del consultorio
          </h2>
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-2xl border-2
              border-dashed border-gray-200 flex items-center
              justify-center overflow-hidden flex-shrink-0">
              {config.logoUrl ? (
                <img src={config.logoUrl} alt="Logo"
                  className="w-full h-full object-contain p-1" />
              ) : (
                <span className="text-3xl">🦶</span>
              )}
            </div>
            <div className="flex-1">
              <p className="text-sm text-gray-600 mb-1">
                {config.logoUrl
                  ? 'Logo cargado correctamente'
                  : 'Sin logo configurado'}
              </p>
              <p className="text-xs text-gray-400 mb-3">
                Aparece en el header y en todos los PDFs
              </p>
              <label className="cursor-pointer inline-flex
                items-center gap-2 bg-primary-50
                hover:bg-primary-100 text-primary-700 text-sm
                font-medium px-4 py-2 rounded-lg transition-colors">
                {subiendoLogo ? 'Subiendo...' : '📷 Subir logo'}
                <input type="file" accept="image/*"
                  className="hidden" disabled={subiendoLogo}
                  onChange={e => {
                    const f = e.target.files?.[0]
                    if (f) subirLogo(f)
                  }}
                />
              </label>
            </div>
          </div>
        </div>

        {/* DATOS */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">
            Datos del consultorio
          </h2>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium
                text-gray-500 mb-1">Nombre del consultorio</label>
              <input value={config.nombre}
                onChange={e => setConfig(prev => ({
                  ...prev, nombre: e.target.value
                }))}
                placeholder="Centro Podológico Erika Correa"
                className="input-field" />
            </div>
            <div>
              <label className="block text-xs font-medium
                text-gray-500 mb-1">Teléfono</label>
              <input value={config.telefono}
                onChange={e => setConfig(prev => ({
                  ...prev, telefono: e.target.value
                }))}
                placeholder="Ej: 987654321"
                className="input-field" />
            </div>
            <div>
              <label className="block text-xs font-medium
                text-gray-500 mb-1">Dirección</label>
              <input value={config.direccion}
                onChange={e => setConfig(prev => ({
                  ...prev, direccion: e.target.value
                }))}
                placeholder="Ej: Av. Los Pinos 123, Lima"
                className="input-field" />
            </div>
          </div>
        </div>

        {error && (
          <p className="text-sm text-red-500 bg-red-50
            rounded-xl p-3">{error}</p>
        )}

        <button onClick={guardar} disabled={guardando}
          className="w-full py-3 rounded-xl bg-primary-600
            hover:bg-primary-700 disabled:bg-primary-300
            text-white text-sm font-medium transition-colors">
          {guardando ? 'Guardando...' : 'Guardar configuración'}
        </button>

        {/* CAMBIAR CONTRASEÑA */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-1">
            Cambiar contraseña
          </h2>
          <p className="text-xs text-gray-400 mb-4">
            Por seguridad, ingresa tu contraseña actual para confirmar
          </p>

          {exitoPass && (
            <div className="bg-green-50 border border-green-100
              rounded-xl p-3 mb-3 text-sm text-green-700 font-medium">
              ✓ {exitoPass}
            </div>
          )}

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium
                text-gray-500 mb-1">Contraseña actual</label>
              <div className="relative">
                <input
                  type={showPassActual ? 'text' : 'password'}
                  value={passActual}
                  onChange={e => setPassActual(e.target.value)}
                  placeholder="••••••••"
                  className="input-field pr-10"
                />
                <button type="button"
                  onClick={() => setShowPassActual(!showPassActual)}
                  className="absolute right-3 top-1/2
                    -translate-y-1/2 text-gray-400
                    hover:text-gray-600">
                  {showPassActual ? '🙈' : '👁️'}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium
                text-gray-500 mb-1">Nueva contraseña</label>
              <div className="relative">
                <input
                  type={showPassNueva ? 'text' : 'password'}
                  value={passNueva}
                  onChange={e => setPassNueva(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  className="input-field pr-10"
                />
                <button type="button"
                  onClick={() => setShowPassNueva(!showPassNueva)}
                  className="absolute right-3 top-1/2
                    -translate-y-1/2 text-gray-400
                    hover:text-gray-600">
                  {showPassNueva ? '🙈' : '👁️'}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium
                text-gray-500 mb-1">Confirmar nueva contraseña</label>
              <input
                type="password"
                value={passConfirmar}
                onChange={e => setPassConfirmar(e.target.value)}
                placeholder="Repetir nueva contraseña"
                className="input-field"
              />
            </div>
          </div>

          {errorPass && (
            <p className="text-xs text-red-500 mt-3 bg-red-50
              rounded-lg p-2">{errorPass}</p>
          )}

          <button
            onClick={cambiarPassword}
            disabled={cambiandoPass}
            className="w-full mt-4 py-3 rounded-xl border-2
              border-primary-600 text-primary-600
              hover:bg-primary-50 disabled:opacity-50
              text-sm font-medium transition-colors"
          >
            {cambiandoPass
              ? 'Actualizando...'
              : 'Actualizar contraseña'}
          </button>
        </div>

      </div>
    </div>
  )
}