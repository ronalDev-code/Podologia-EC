'use client'

import { useState, useEffect, useCallback } from 'react'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/lib/auth-context'

interface UsuarioItem {
  uid: string
  nombre: string
  email: string
  activo: boolean
  fechaCreacion?: string
}

export default function UsuariosPage() {
  const { user } = useAuth()
  const [usuarios, setUsuarios] = useState<UsuarioItem[]>([])
  const [loading, setLoading] = useState(true)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [exito, setExito] = useState('')

  // Form nuevo usuario
  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  // Eliminar
  const [usuarioAEliminar, setUsuarioAEliminar] =
    useState<UsuarioItem | null>(null)
  const [eliminando, setEliminando] = useState(false)

  const cargarUsuarios = useCallback(async () => {
    setLoading(true)
    try {
      const snap = await getDocs(collection(db, 'usuarios'))
      setUsuarios(snap.docs.map(d => ({
        uid: d.id, ...d.data()
      })) as UsuarioItem[])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { cargarUsuarios() }, [cargarUsuarios])

  async function crearUsuario() {
    setError('')
    if (!nombre.trim() || !email.trim() || !password.trim()) {
      setError('Todos los campos son obligatorios')
      return
    }
    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres')
      return
    }
    if (password !== confirmar) {
      setError('Las contraseñas no coinciden')
      return
    }
    setGuardando(true)
    try {
      const res = await fetch('/api/usuarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: nombre.trim(),
          email: email.trim(),
          password,
          creadoPor: user?.uid,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al crear usuario')
      setExito(`Usuario ${nombre} creado correctamente`)
      setMostrarForm(false)
      setNombre(''); setEmail('')
      setPassword(''); setConfirmar('')
      cargarUsuarios()
      setTimeout(() => setExito(''), 4000)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error')
    } finally {
      setGuardando(false)
    }
  }

  async function eliminarUsuario() {
    if (!usuarioAEliminar) return
    setEliminando(true)
    try {
      const res = await fetch('/api/usuarios', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: usuarioAEliminar.uid }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al eliminar')
      setExito(`Usuario ${usuarioAEliminar.nombre} eliminado`)
      setUsuarioAEliminar(null)
      cargarUsuarios()
      setTimeout(() => setExito(''), 4000)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al eliminar')
      setUsuarioAEliminar(null)
    } finally {
      setEliminando(false)
    }
  }

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-800">
            Usuarios
          </h1>
          <p className="text-sm text-gray-500">
            Administradores del sistema
          </p>
        </div>
        <button
          onClick={() => { setMostrarForm(true); setError('') }}
          className="inline-flex items-center gap-2 bg-primary-600
            hover:bg-primary-700 text-white text-sm font-medium
            px-4 py-2.5 rounded-lg transition-colors"
        >
          + Nuevo
        </button>
      </div>

      {exito && (
        <div className="bg-green-50 border border-green-100
          rounded-xl p-3 mb-4 text-sm text-green-700 font-medium">
          ✓ {exito}
        </div>
      )}

      {error && !mostrarForm && (
        <div className="bg-red-50 border border-red-100
          rounded-xl p-3 mb-4 text-sm text-red-600">
          {error}
        </div>
      )}

      {/* Lista */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(2)].map((_, i) => (
            <div key={i}
              className="h-16 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : usuarios.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-4xl mb-3">👤</p>
          <p className="text-gray-500 text-sm">
            No hay usuarios registrados
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {usuarios.map(u => (
            <div key={u.uid}
              className="flex items-center gap-3 bg-white border
                border-gray-100 rounded-xl px-4 py-3">

              {/* Avatar */}
              <div className="w-10 h-10 rounded-full bg-primary-50
                flex items-center justify-center text-primary-600
                font-semibold text-sm flex-shrink-0">
                {u.nombre?.charAt(0)?.toUpperCase() || '?'}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-medium text-gray-800">
                    {u.nombre}
                  </p>
                  {u.uid === user?.uid && (
                    <span className="text-[10px] bg-primary-100
                      text-primary-600 px-1.5 py-0.5 rounded-full
                      font-medium">
                      Tú
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-400 truncate">
                  {u.email}
                </p>
              </div>

              {/* Badge + Eliminar */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-xs bg-green-100 text-green-700
                  px-2 py-1 rounded-full font-medium">
                  Admin
                </span>
                {/* No puede eliminarse a sí mismo */}
                {u.uid !== user?.uid && (
                  <button
                    onClick={() => setUsuarioAEliminar(u)}
                    className="w-8 h-8 flex items-center justify-center
                      rounded-lg text-gray-300 hover:text-red-500
                      hover:bg-red-50 transition-colors"
                    title="Eliminar usuario"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24"
                      fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="3 6 5 6 21 6"/>
                      <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0
                        01-2-2L5 6"/>
                      <path d="M10 11v6M14 11v6"/>
                      <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011
                        1v2"/>
                    </svg>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODAL NUEVO USUARIO */}
      {mostrarForm && (
        <div className="fixed inset-0 bg-black/50 z-50
          flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6">
            <h3 className="text-base font-semibold text-gray-800 mb-1">
              Nuevo usuario administrador
            </h3>
            <p className="text-xs text-gray-400 mb-4">
              Tendrá acceso completo al sistema
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium
                  text-gray-500 mb-1">
                  Nombre completo *
                </label>
                <input
                  value={nombre}
                  onChange={e => setNombre(e.target.value)}
                  placeholder="Ej: Erika Correa"
                  className="input-field"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs font-medium
                  text-gray-500 mb-1">
                  Correo electrónico *
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="correo@ejemplo.com"
                  className="input-field"
                />
              </div>
              <div>
                <label className="block text-xs font-medium
                  text-gray-500 mb-1">
                  Contraseña *
                </label>
                <div className="relative">
                  <input
                    type={showPass ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    className="input-field pr-10"
                  />
                  <button type="button"
                    onClick={() => setShowPass(!showPass)}
                    className="absolute right-3 top-1/2
                      -translate-y-1/2 text-gray-400
                      hover:text-gray-600 transition-colors">
                    {showPass ? (
                      <svg width="16" height="16"
                        viewBox="0 0 24 24" fill="none"
                        stroke="currentColor" strokeWidth="2">
                        <path d="M17.94 17.94A10.07 10.07 0
                          0112 20c-7 0-11-8-11-8a18.45 18.45
                          0 015.06-5.94M9.9 4.24A9.12 9.12 0
                          0112 4c7 0 11 8 11 8a18.5 18.5 0
                          01-2.16 3.19m-6.72-1.07a3 3 0
                          11-4.24-4.24"/>
                        <line x1="1" y1="1" x2="23" y2="23"/>
                      </svg>
                    ) : (
                      <svg width="16" height="16"
                        viewBox="0 0 24 24" fill="none"
                        stroke="currentColor" strokeWidth="2">
                        <path d="M1 12s4-8 11-8 11 8 11
                          8-4 8-11 8-11-8-11-8z"/>
                        <circle cx="12" cy="12" r="3"/>
                      </svg>
                    )}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium
                  text-gray-500 mb-1">
                  Confirmar contraseña *
                </label>
                <div className="relative">
                  <input
                    type={showConfirm ? 'text' : 'password'}
                    value={confirmar}
                    onChange={e => setConfirmar(e.target.value)}
                    placeholder="Repetir contraseña"
                    className="input-field pr-10"
                  />
                  <button type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute right-3 top-1/2
                      -translate-y-1/2 text-gray-400
                      hover:text-gray-600 transition-colors">
                    {showConfirm ? (
                      <svg width="16" height="16"
                        viewBox="0 0 24 24" fill="none"
                        stroke="currentColor" strokeWidth="2">
                        <path d="M17.94 17.94A10.07 10.07 0
                          0112 20c-7 0-11-8-11-8a18.45 18.45
                          0 015.06-5.94M9.9 4.24A9.12 9.12 0
                          0112 4c7 0 11 8 11 8a18.5 18.5 0
                          01-2.16 3.19m-6.72-1.07a3 3 0
                          11-4.24-4.24"/>
                        <line x1="1" y1="1" x2="23" y2="23"/>
                      </svg>
                    ) : (
                      <svg width="16" height="16"
                        viewBox="0 0 24 24" fill="none"
                        stroke="currentColor" strokeWidth="2">
                        <path d="M1 12s4-8 11-8 11 8 11
                          8-4 8-11 8-11-8-11-8z"/>
                        <circle cx="12" cy="12" r="3"/>
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {error && (
              <p className="text-xs text-red-500 mt-3 bg-red-50
                rounded-lg p-2">{error}</p>
            )}

            <div className="flex gap-3 mt-4">
              <button
                onClick={() => {
                  setMostrarForm(false); setError('')
                  setNombre(''); setEmail('')
                  setPassword(''); setConfirmar('')
                }}
                className="flex-1 py-2.5 rounded-xl border
                  border-gray-200 text-sm text-gray-600
                  hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={crearUsuario}
                disabled={guardando}
                className="flex-1 py-2.5 rounded-xl bg-primary-600
                  hover:bg-primary-700 disabled:bg-primary-300
                  text-white text-sm font-medium transition-colors"
              >
                {guardando ? 'Creando...' : 'Crear usuario'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CONFIRMAR ELIMINACIÓN */}
      {usuarioAEliminar && (
        <div className="fixed inset-0 bg-black/60 z-50
          flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100
                flex items-center justify-center flex-shrink-0">
                <svg width="20" height="20" viewBox="0 0 24 24"
                  fill="none" stroke="#EF4444" strokeWidth="2">
                  <polyline points="3 6 5 6 21 6"/>
                  <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0
                    01-2-2L5 6"/>
                  <path d="M10 11v6M14 11v6"/>
                  <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/>
                </svg>
              </div>
              <div>
                <h3 className="text-base font-semibold text-gray-800">
                  Eliminar usuario
                </h3>
                <p className="text-xs text-red-500 font-medium">
                  Esta acción no se puede deshacer
                </p>
              </div>
            </div>

            <div className="bg-gray-50 rounded-xl p-3 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-primary-50
                  flex items-center justify-center text-primary-600
                  font-semibold text-sm flex-shrink-0">
                  {usuarioAEliminar.nombre?.charAt(0)?.toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-800">
                    {usuarioAEliminar.nombre}
                  </p>
                  <p className="text-xs text-gray-400">
                    {usuarioAEliminar.email}
                  </p>
                </div>
              </div>
            </div>

            <p className="text-sm text-gray-600 mb-4">
              Este usuario perderá acceso inmediato al sistema y
              no podrá iniciar sesión.
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => setUsuarioAEliminar(null)}
                disabled={eliminando}
                className="flex-1 py-2.5 rounded-xl border
                  border-gray-200 text-sm text-gray-600
                  hover:bg-gray-50 transition-colors
                  disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={eliminarUsuario}
                disabled={eliminando}
                className="flex-1 py-2.5 rounded-xl bg-red-500
                  hover:bg-red-600 disabled:bg-red-300
                  text-white text-sm font-medium transition-colors"
              >
                {eliminando ? 'Eliminando...' : 'Sí, eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}