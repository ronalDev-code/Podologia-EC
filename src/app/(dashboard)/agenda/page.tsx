'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  collection, query, orderBy, limit, getDocs,
  addDoc, updateDoc, doc, serverTimestamp,
  where, Timestamp, getDoc
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/lib/auth-context'
import { Paciente } from '@/types'

interface Cita {
  id: string
  pacienteId: string
  pacienteNombre: string
  fecha: string
  hora: string
  motivo: string
  estado: 'pendiente' | 'atendida' | 'cancelada'
  creadoPor: string
}

const ESTADOS = {
  pendiente: { label: 'Pendiente', color: 'bg-amber-100 text-amber-700' },
  atendida: { label: 'Atendida', color: 'bg-green-100 text-green-700' },
  cancelada: { label: 'Cancelada', color: 'bg-red-100 text-red-700' },
}

export default function AgendaPage() {
  const { user } = useAuth()
  const [citas, setCitas] = useState<Cita[]>([])
  const [loading, setLoading] = useState(true)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [filtroFecha, setFiltroFecha] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('todos')

  // Form nueva cita
  const [pacientes, setPacientes] = useState<Paciente[]>([])
  const [busquedaPac, setBusquedaPac] = useState('')
  const [pacienteSeleccionado, setPacienteSeleccionado] =
    useState<Paciente | null>(null)
  const [mostrarBusqueda, setMostrarBusqueda] = useState(false)
  const [fecha, setFecha] = useState('')
  const [hora, setHora] = useState('')
  const [motivo, setMotivo] = useState('')

  const hoy = new Date().toISOString().split('T')[0]

  const cargarCitas = useCallback(async () => {
    setLoading(true)
    try {
      const q = query(
        collection(db, 'citas'),
        orderBy('fecha', 'asc'),
        limit(100)
      )
      const snap = await getDocs(q)
      const data = snap.docs.map(d => ({
        id: d.id, ...d.data()
      })) as Cita[]
      setCitas(data)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { cargarCitas() }, [cargarCitas])

  async function buscarPacientes(texto: string) {
    setBusquedaPac(texto)
    if (texto.trim().length < 2) { setPacientes([]); return }
    const snap = await getDocs(query(
      collection(db, 'pacientes'),
      orderBy('apellido'),
      limit(30)
    ))
    const todos = snap.docs.map(d => ({
      id: d.id, ...d.data()
    })) as Paciente[]
    const t = texto.toLowerCase()
    setPacientes(todos.filter(p =>
      `${p.nombre} ${p.apellido}`.toLowerCase().includes(t) ||
      p.dni?.includes(t)
    ))
  }

  async function crearCita() {
    setError('')
    if (!pacienteSeleccionado) {
      setError('Selecciona un paciente')
      return
    }
    if (!fecha || !hora || !motivo.trim()) {
      setError('Fecha, hora y motivo son obligatorios')
      return
    }
    setGuardando(true)
    try {
      const nuevaCita = {
        pacienteId: pacienteSeleccionado.id,
        pacienteNombre: `${pacienteSeleccionado.nombre} ${pacienteSeleccionado.apellido}`,
        fecha,
        hora,
        motivo: motivo.trim(),
        estado: 'pendiente',
        creadoPor: user?.uid,
        fechaCreacion: serverTimestamp(),
      }
      const ref = await addDoc(collection(db, 'citas'), nuevaCita)
      setCitas(prev => [...prev, {
        id: ref.id, ...nuevaCita
      } as Cita].sort((a, b) =>
        a.fecha.localeCompare(b.fecha) ||
        a.hora.localeCompare(b.hora)
      ))
      setMostrarForm(false)
      setPacienteSeleccionado(null)
      setBusquedaPac('')
      setPacientes([])
      setFecha('')
      setHora('')
      setMotivo('')
    } catch {
      setError('Error al guardar la cita')
    } finally {
      setGuardando(false)
    }
  }

  async function cambiarEstado(
    citaId: string,
    nuevoEstado: 'atendida' | 'cancelada' | 'pendiente'
  ) {
    try {
      await updateDoc(doc(db, 'citas', citaId), {
        estado: nuevoEstado
      })
      setCitas(prev => prev.map(c =>
        c.id === citaId ? { ...c, estado: nuevoEstado } : c
      ))
    } catch {
      console.error('Error al actualizar estado')
    }
  }

  function formatFecha(fecha: string): string {
    if (!fecha) return '—'
    const [y, m, d] = fecha.split('-')
    const date = new Date(Number(y), Number(m) - 1, Number(d))
    return date.toLocaleDateString('es-PE', {
      weekday: 'long', day: '2-digit',
      month: 'long', year: 'numeric'
    })
  }

  // Filtrar citas
  const citasFiltradas = citas.filter(c => {
    if (filtroEstado !== 'todos' && c.estado !== filtroEstado)
      return false
    if (filtroFecha && c.fecha !== filtroFecha) return false
    return true
  })

  // Separar citas de hoy, próximas y pasadas
  const citasHoy = citasFiltradas.filter(c => c.fecha === hoy)
  const citasProximas = citasFiltradas.filter(c =>
    c.fecha > hoy && c.estado === 'pendiente'
  )
  const citasPasadas = citasFiltradas.filter(c =>
    c.fecha < hoy || c.estado !== 'pendiente'
  ).sort((a, b) => b.fecha.localeCompare(a.fecha))

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-800">
            Agenda
          </h1>
          <p className="text-sm text-gray-500">
            Citas y próximas atenciones
          </p>
        </div>
        <button
          onClick={() => { setMostrarForm(true); setError('') }}
          className="inline-flex items-center gap-2 bg-primary-600
            hover:bg-primary-700 text-white text-sm font-medium
            px-4 py-2.5 rounded-lg transition-colors"
        >
          + Nueva cita
        </button>
      </div>

      {/* Filtros */}
      <div className="flex gap-2 mb-4 flex-wrap">
        <input
          type="date"
          value={filtroFecha}
          onChange={e => setFiltroFecha(e.target.value)}
          className="input-field w-auto text-sm py-2"
        />
        {filtroFecha && (
          <button
            onClick={() => setFiltroFecha('')}
            className="text-xs text-gray-400 hover:text-gray-600
              px-2 py-2 rounded-lg border border-gray-200 bg-white"
          >
            ✕
          </button>
        )}
        {(['todos', 'pendiente', 'atendida', 'cancelada'] as const).map(e => (
          <button
            key={e}
            onClick={() => setFiltroEstado(e)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium
              border transition-all capitalize
              ${filtroEstado === e
                ? 'bg-primary-600 text-white border-primary-600'
                : 'bg-white text-gray-600 border-gray-200'
              }`}
          >
            {e === 'todos' ? 'Todas' : ESTADOS[e].label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i}
              className="h-20 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-6">

          {/* CITAS DE HOY */}
          {citasHoy.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="w-2 h-2 rounded-full bg-primary-500" />
                <h2 className="text-sm font-semibold text-gray-700">
                  Hoy — {formatFecha(hoy)}
                </h2>
                <span className="text-xs bg-primary-100 text-primary-700
                  px-2 py-0.5 rounded-full font-medium">
                  {citasHoy.length}
                </span>
              </div>
              <div className="space-y-2">
                {citasHoy.map(cita => (
                  <CitaCard
                    key={cita.id}
                    cita={cita}
                    onCambiarEstado={cambiarEstado}
                    highlight
                  />
                ))}
              </div>
            </div>
          )}

          {/* PRÓXIMAS CITAS */}
          {citasProximas.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                <h2 className="text-sm font-semibold text-gray-700">
                  Próximas citas
                </h2>
                <span className="text-xs bg-amber-100 text-amber-700
                  px-2 py-0.5 rounded-full font-medium">
                  {citasProximas.length}
                </span>
              </div>
              <div className="space-y-2">
                {citasProximas.map(cita => (
                  <CitaCard
                    key={cita.id}
                    cita={cita}
                    onCambiarEstado={cambiarEstado}
                  />
                ))}
              </div>
            </div>
          )}

          {/* CITAS PASADAS / ATENDIDAS / CANCELADAS */}
          {citasPasadas.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="w-2 h-2 rounded-full bg-gray-300" />
                <h2 className="text-sm font-semibold text-gray-700">
                  Historial
                </h2>
              </div>
              <div className="space-y-2">
                {citasPasadas.map(cita => (
                  <CitaCard
                    key={cita.id}
                    cita={cita}
                    onCambiarEstado={cambiarEstado}
                  />
                ))}
              </div>
            </div>
          )}

          {citasFiltradas.length === 0 && (
            <div className="text-center py-16">
              <p className="text-4xl mb-3">📅</p>
              <p className="text-gray-500 text-sm">
                No hay citas registradas
              </p>
              <button
                onClick={() => setMostrarForm(true)}
                className="inline-block mt-4 text-sm text-primary-600
                  hover:text-primary-700 font-medium"
              >
                Agendar primera cita →
              </button>
            </div>
          )}

        </div>
      )}

      {/* MODAL NUEVA CITA */}
      {mostrarForm && (
        <div className="fixed inset-0 bg-black/50 z-50
          flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6
            max-h-[90vh] overflow-y-auto">
            <h3 className="text-base font-semibold text-gray-800 mb-4">
              Nueva cita
            </h3>

            <div className="space-y-3">

              {/* Buscar paciente */}
              <div>
                <label className="block text-xs font-medium
                  text-gray-500 mb-1">
                  Paciente *
                </label>
                {pacienteSeleccionado ? (
                  <div className="flex items-center gap-2 p-3
                    bg-primary-50 rounded-xl border border-primary-200">
                    <div className="w-8 h-8 rounded-full bg-primary-100
                      flex items-center justify-center text-primary-600
                      font-semibold text-xs flex-shrink-0">
                      {pacienteSeleccionado.nombre.charAt(0)}
                      {pacienteSeleccionado.apellido.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800">
                        {pacienteSeleccionado.nombre}{' '}
                        {pacienteSeleccionado.apellido}
                      </p>
                      <p className="text-xs text-gray-400">
                        DNI: {pacienteSeleccionado.dni}
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setPacienteSeleccionado(null)
                        setBusquedaPac('')
                        setPacientes([])
                      }}
                      className="text-gray-400 hover:text-red-400
                        transition-colors text-lg flex-shrink-0"
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <input
                      value={busquedaPac}
                      onChange={e => buscarPacientes(e.target.value)}
                      onFocus={() => setMostrarBusqueda(true)}
                      placeholder="Buscar por nombre o DNI..."
                      className="input-field"
                      autoFocus
                    />
                    {pacientes.length > 0 && mostrarBusqueda && (
                      <div className="absolute top-full left-0 right-0
                        bg-white border border-gray-200 rounded-xl
                        shadow-lg z-10 max-h-48 overflow-y-auto mt-1">
                        {pacientes.map(p => (
                          <button
                            key={p.id}
                            onClick={() => {
                              setPacienteSeleccionado(p)
                              setBusquedaPac('')
                              setPacientes([])
                              setMostrarBusqueda(false)
                            }}
                            className="w-full flex items-center gap-3
                              px-3 py-2.5 hover:bg-gray-50
                              transition-colors text-left border-b
                              border-gray-50 last:border-0"
                          >
                            <div className="w-7 h-7 rounded-full
                              bg-primary-50 flex items-center
                              justify-center text-primary-600
                              font-semibold text-xs flex-shrink-0">
                              {p.nombre.charAt(0)}{p.apellido.charAt(0)}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium
                                text-gray-800 truncate">
                                {p.nombre} {p.apellido}
                              </p>
                              <p className="text-xs text-gray-400">
                                DNI: {p.dni}
                              </p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Fecha */}
              <div>
                <label className="block text-xs font-medium
                  text-gray-500 mb-1">
                  Fecha *
                </label>
                <input
                  type="date"
                  value={fecha}
                  onChange={e => setFecha(e.target.value)}
                  min={hoy}
                  className="input-field"
                />
              </div>

              {/* Hora */}
              <div>
                <label className="block text-xs font-medium
                  text-gray-500 mb-1">
                  Hora *
                </label>
                <input
                  type="time"
                  value={hora}
                  onChange={e => setHora(e.target.value)}
                  className="input-field"
                />
              </div>

              {/* Motivo */}
              <div>
                <label className="block text-xs font-medium
                  text-gray-500 mb-1">
                  Motivo *
                </label>
                <input
                  value={motivo}
                  onChange={e => setMotivo(e.target.value)}
                  placeholder="Ej: Quiropodia, control, láser..."
                  className="input-field"
                />
              </div>
            </div>

            {error && (
              <p className="text-xs text-red-500 mt-3 bg-red-50
                rounded-lg p-2">{error}</p>
            )}

            <div className="flex gap-3 mt-4">
              <button
                onClick={() => {
                  setMostrarForm(false)
                  setError('')
                  setPacienteSeleccionado(null)
                  setBusquedaPac('')
                  setPacientes([])
                  setFecha('')
                  setHora('')
                  setMotivo('')
                }}
                className="flex-1 py-2.5 rounded-xl border
                  border-gray-200 text-sm text-gray-600
                  hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={crearCita}
                disabled={guardando}
                className="flex-1 py-2.5 rounded-xl bg-primary-600
                  hover:bg-primary-700 disabled:bg-primary-300
                  text-white text-sm font-medium transition-colors"
              >
                {guardando ? 'Guardando...' : 'Agendar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Componente tarjeta de cita
function CitaCard({
  cita,
  onCambiarEstado,
  highlight = false,
}: {
  cita: Cita
  onCambiarEstado: (
    id: string,
    estado: 'atendida' | 'cancelada' | 'pendiente'
  ) => void
  highlight?: boolean
}) {
  const [mostrarOpciones, setMostrarOpciones] = useState(false)

  function formatFechaCita(fecha: string): string {
    if (!fecha) return '—'
    const [y, m, d] = fecha.split('-')
    const date = new Date(Number(y), Number(m) - 1, Number(d))
    return date.toLocaleDateString('es-PE', {
      weekday: 'short', day: '2-digit', month: 'short'
    })
  }

  return (
    <div className={`bg-white rounded-xl border transition-all
      ${highlight
        ? 'border-primary-300 shadow-sm shadow-primary-100'
        : 'border-gray-100'
      }`}>
      <div className="flex items-center gap-3 p-3">

        {/* Hora */}
        <div className={`flex-shrink-0 text-center w-14 py-2
          rounded-lg
          ${highlight ? 'bg-primary-50' : 'bg-gray-50'}`}>
          <p className={`text-xs font-bold
            ${highlight ? 'text-primary-600' : 'text-gray-500'}`}>
            {cita.hora || '—'}
          </p>
          <p className="text-[10px] text-gray-400 mt-0.5">
            {formatFechaCita(cita.fecha)}
          </p>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-800 truncate">
            {cita.pacienteNombre}
          </p>
          <p className="text-xs text-gray-400 truncate mt-0.5">
            {cita.motivo}
          </p>
        </div>

        {/* Estado + opciones */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className={`text-[10px] px-2 py-1 rounded-full
            font-medium ${ESTADOS[cita.estado].color}`}>
            {ESTADOS[cita.estado].label}
          </span>

          {/* Menú acciones */}
          <div className="relative">
            <button
              onClick={() => setMostrarOpciones(!mostrarOpciones)}
              className="w-7 h-7 flex items-center justify-center
                text-gray-400 hover:text-gray-600 rounded-lg
                hover:bg-gray-100 transition-colors text-base"
            >
              ···
            </button>
            {mostrarOpciones && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setMostrarOpciones(false)}
                />
                <div className="absolute right-0 top-8 bg-white
                  border border-gray-100 rounded-xl shadow-lg
                  z-20 min-w-36 overflow-hidden">
                  {cita.estado !== 'atendida' && (
                    <button
                      onClick={() => {
                        onCambiarEstado(cita.id, 'atendida')
                        setMostrarOpciones(false)
                      }}
                      className="w-full text-left px-4 py-2.5 text-sm
                        text-green-600 hover:bg-green-50 transition-colors"
                    >
                      ✓ Marcar atendida
                    </button>
                  )}
                  {cita.estado !== 'pendiente' && (
                    <button
                      onClick={() => {
                        onCambiarEstado(cita.id, 'pendiente')
                        setMostrarOpciones(false)
                      }}
                      className="w-full text-left px-4 py-2.5 text-sm
                        text-amber-600 hover:bg-amber-50 transition-colors"
                    >
                      ↩ Marcar pendiente
                    </button>
                  )}
                  {cita.estado !== 'cancelada' && (
                    <button
                      onClick={() => {
                        onCambiarEstado(cita.id, 'cancelada')
                        setMostrarOpciones(false)
                      }}
                      className="w-full text-left px-4 py-2.5 text-sm
                        text-red-500 hover:bg-red-50 transition-colors"
                    >
                      ✕ Cancelar cita
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}