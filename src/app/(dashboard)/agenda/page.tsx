'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  collection, query, orderBy, limit, getDocs,
  addDoc, updateDoc, deleteDoc, doc, serverTimestamp,
  getDoc
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

// ── Helpers de fecha (hora local del dispositivo = hora de Perú) ──
// IMPORTANTE: nunca usar toISOString() para obtener "hoy" ni para
// comparar fechas, porque convierte a UTC y en Perú (UTC-5) eso
// puede adelantar la fecha en las horas de la tarde/noche.

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

function getHoyStr(): string {
  const ahora = new Date()
  return `${ahora.getFullYear()}-${pad2(ahora.getMonth() + 1)}-${pad2(ahora.getDate())}`
}

function parseDateLocal(fecha: string): Date {
  const [y, m, d] = fecha.split('-').map(Number)
  return new Date(y, (m || 1) - 1, d || 1)
}

async function buscarPacientesPorTexto(texto: string): Promise<Paciente[]> {
  if (texto.trim().length < 2) return []
  const snap = await getDocs(query(
    collection(db, 'pacientes'),
    orderBy('apellido'),
    limit(30)
  ))
  const todos = snap.docs.map(d => ({
    id: d.id, ...d.data()
  })) as Paciente[]
  const t = texto.toLowerCase()
  return todos.filter(p =>
    `${p.nombre} ${p.apellido}`.toLowerCase().includes(t) ||
    p.dni?.includes(t)
  )
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
  const [mostrarCalendario, setMostrarCalendario] = useState(false)

  // Form nueva cita
  const [pacientes, setPacientes] = useState<Paciente[]>([])
  const [busquedaPac, setBusquedaPac] = useState('')
  const [pacienteSeleccionado, setPacienteSeleccionado] =
    useState<Paciente | null>(null)
  const [mostrarBusqueda, setMostrarBusqueda] = useState(false)
  const [fecha, setFecha] = useState('')
  const [hora, setHora] = useState('')
  const [motivo, setMotivo] = useState('')

  // Editar cita
  const [citaEditando, setCitaEditando] = useState<Cita | null>(null)
  const [pacientesEdit, setPacientesEdit] = useState<Paciente[]>([])
  const [busquedaPacEdit, setBusquedaPacEdit] = useState('')
  const [pacienteSeleccionadoEdit, setPacienteSeleccionadoEdit] =
    useState<Paciente | null>(null)
  const [mostrarBusquedaEdit, setMostrarBusquedaEdit] = useState(false)
  const [fechaEdit, setFechaEdit] = useState('')
  const [horaEdit, setHoraEdit] = useState('')
  const [motivoEdit, setMotivoEdit] = useState('')
  const [guardandoEdit, setGuardandoEdit] = useState(false)
  const [errorEdit, setErrorEdit] = useState('')

  // Eliminar cita
  const [citaEliminando, setCitaEliminando] = useState<Cita | null>(null)
  const [eliminando, setEliminando] = useState(false)
  const [errorEliminar, setErrorEliminar] = useState('')

  const hoy = getHoyStr()

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
    const resultados = await buscarPacientesPorTexto(texto)
    setPacientes(resultados)
  }

  async function buscarPacientesEdit(texto: string) {
    setBusquedaPacEdit(texto)
    const resultados = await buscarPacientesPorTexto(texto)
    setPacientesEdit(resultados)
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

  // ── Editar cita ──────────────────────────────────────────
  async function abrirEditar(cita: Cita) {
    setCitaEditando(cita)
    setFechaEdit(cita.fecha)
    setHoraEdit(cita.hora)
    setMotivoEdit(cita.motivo)
    setErrorEdit('')
    setBusquedaPacEdit('')
    setPacientesEdit([])
    setMostrarBusquedaEdit(false)
    setPacienteSeleccionadoEdit(null)
    try {
      const snap = await getDoc(doc(db, 'pacientes', cita.pacienteId))
      if (snap.exists()) {
        setPacienteSeleccionadoEdit({
          id: snap.id, ...snap.data()
        } as Paciente)
      }
    } catch {
      // si falla la carga, el usuario puede volver a
      // seleccionar el paciente manualmente en el modal
    }
  }

  function cerrarEditar() {
    setCitaEditando(null)
    setPacienteSeleccionadoEdit(null)
    setBusquedaPacEdit('')
    setPacientesEdit([])
    setMostrarBusquedaEdit(false)
    setFechaEdit('')
    setHoraEdit('')
    setMotivoEdit('')
    setErrorEdit('')
  }

  async function guardarEdicion() {
    if (!citaEditando) return
    setErrorEdit('')
    if (!pacienteSeleccionadoEdit) {
      setErrorEdit('Selecciona un paciente')
      return
    }
    if (!fechaEdit || !horaEdit || !motivoEdit.trim()) {
      setErrorEdit('Fecha, hora y motivo son obligatorios')
      return
    }
    setGuardandoEdit(true)
    try {
      const datosActualizados = {
        pacienteId: pacienteSeleccionadoEdit.id,
        pacienteNombre: `${pacienteSeleccionadoEdit.nombre} ${pacienteSeleccionadoEdit.apellido}`,
        fecha: fechaEdit,
        hora: horaEdit,
        motivo: motivoEdit.trim(),
      }
      await updateDoc(doc(db, 'citas', citaEditando.id), datosActualizados)
      setCitas(prev => prev.map(c =>
        c.id === citaEditando.id ? { ...c, ...datosActualizados } : c
      ).sort((a, b) =>
        a.fecha.localeCompare(b.fecha) ||
        a.hora.localeCompare(b.hora)
      ))
      cerrarEditar()
    } catch {
      setErrorEdit('Error al actualizar la cita')
    } finally {
      setGuardandoEdit(false)
    }
  }

  // ── Eliminar cita ────────────────────────────────────────
  async function eliminarCita() {
    if (!citaEliminando) return
    setErrorEliminar('')
    setEliminando(true)
    try {
      await deleteDoc(doc(db, 'citas', citaEliminando.id))
      setCitas(prev => prev.filter(c => c.id !== citaEliminando.id))
      setCitaEliminando(null)
    } catch {
      setErrorEliminar('Error al eliminar la cita')
    } finally {
      setEliminando(false)
    }
  }

  function formatFecha(fecha: string): string {
    if (!fecha) return '—'
    const date = parseDateLocal(fecha)
    return date.toLocaleDateString('es-PE', {
      weekday: 'long', day: '2-digit',
      month: 'long', year: 'numeric'
    })
  }

  // Fechas con citas, según el filtro de estado activo
  // (se usa para pintar los puntos en el mini-calendario)
  const fechasConCitas = useMemo(() => {
    const set = new Set<string>()
    citas.forEach(c => {
      if (filtroEstado === 'todos' || c.estado === filtroEstado) {
        set.add(c.fecha)
      }
    })
    return set
  }, [citas, filtroEstado])

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
      <div className="flex gap-2 mb-4 flex-wrap items-center">
        <input
          type="date"
          value={filtroFecha}
          onChange={e => setFiltroFecha(e.target.value)}
          className="input-field w-auto text-sm py-2"
        />

        <div className="relative">
          <button
            type="button"
            onClick={() => setMostrarCalendario(v => !v)}
            title="Ver calendario de citas"
            className={`w-9 h-9 flex items-center justify-center
              rounded-lg border text-sm transition-colors
              ${mostrarCalendario
                ? 'bg-primary-50 border-primary-300 text-primary-600'
                : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
              }`}
          >
            📅
          </button>
          {mostrarCalendario && (
            <MiniCalendario
              fechaSeleccionada={filtroFecha}
              onSeleccionar={setFiltroFecha}
              onCerrar={() => setMostrarCalendario(false)}
              fechasConCitas={fechasConCitas}
            />
          )}
        </div>

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
                    onEditar={abrirEditar}
                    onEliminar={setCitaEliminando}
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
                    onEditar={abrirEditar}
                    onEliminar={setCitaEliminando}
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
                    onEditar={abrirEditar}
                    onEliminar={setCitaEliminando}
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

      {/* MODAL EDITAR CITA */}
      {citaEditando && (
        <div className="fixed inset-0 bg-black/50 z-50
          flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6
            max-h-[90vh] overflow-y-auto">
            <h3 className="text-base font-semibold text-gray-800 mb-4">
              Editar cita
            </h3>

            <div className="space-y-3">

              {/* Buscar / cambiar paciente */}
              <div>
                <label className="block text-xs font-medium
                  text-gray-500 mb-1">
                  Paciente *
                </label>
                {pacienteSeleccionadoEdit ? (
                  <div className="flex items-center gap-2 p-3
                    bg-primary-50 rounded-xl border border-primary-200">
                    <div className="w-8 h-8 rounded-full bg-primary-100
                      flex items-center justify-center text-primary-600
                      font-semibold text-xs flex-shrink-0">
                      {pacienteSeleccionadoEdit.nombre.charAt(0)}
                      {pacienteSeleccionadoEdit.apellido.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800">
                        {pacienteSeleccionadoEdit.nombre}{' '}
                        {pacienteSeleccionadoEdit.apellido}
                      </p>
                      <p className="text-xs text-gray-400">
                        DNI: {pacienteSeleccionadoEdit.dni}
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setPacienteSeleccionadoEdit(null)
                        setBusquedaPacEdit('')
                        setPacientesEdit([])
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
                      value={busquedaPacEdit}
                      onChange={e => buscarPacientesEdit(e.target.value)}
                      onFocus={() => setMostrarBusquedaEdit(true)}
                      placeholder="Buscar por nombre o DNI..."
                      className="input-field"
                      autoFocus
                    />
                    {pacientesEdit.length > 0 && mostrarBusquedaEdit && (
                      <div className="absolute top-full left-0 right-0
                        bg-white border border-gray-200 rounded-xl
                        shadow-lg z-10 max-h-48 overflow-y-auto mt-1">
                        {pacientesEdit.map(p => (
                          <button
                            key={p.id}
                            onClick={() => {
                              setPacienteSeleccionadoEdit(p)
                              setBusquedaPacEdit('')
                              setPacientesEdit([])
                              setMostrarBusquedaEdit(false)
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
                  value={fechaEdit}
                  onChange={e => setFechaEdit(e.target.value)}
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
                  value={horaEdit}
                  onChange={e => setHoraEdit(e.target.value)}
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
                  value={motivoEdit}
                  onChange={e => setMotivoEdit(e.target.value)}
                  placeholder="Ej: Quiropodia, control, láser..."
                  className="input-field"
                />
              </div>
            </div>

            {errorEdit && (
              <p className="text-xs text-red-500 mt-3 bg-red-50
                rounded-lg p-2">{errorEdit}</p>
            )}

            <div className="flex gap-3 mt-4">
              <button
                onClick={cerrarEditar}
                className="flex-1 py-2.5 rounded-xl border
                  border-gray-200 text-sm text-gray-600
                  hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={guardarEdicion}
                disabled={guardandoEdit}
                className="flex-1 py-2.5 rounded-xl bg-primary-600
                  hover:bg-primary-700 disabled:bg-primary-300
                  text-white text-sm font-medium transition-colors"
              >
                {guardandoEdit ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CONFIRMAR ELIMINAR */}
      {citaEliminando && (
        <div className="fixed inset-0 bg-black/50 z-50
          flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6">
            <h3 className="text-base font-semibold text-gray-800 mb-2">
              ¿Eliminar esta cita?
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              Se eliminará permanentemente la cita de{' '}
              <span className="font-medium text-gray-700">
                {citaEliminando.pacienteNombre}
              </span>{' '}
              del {formatFecha(citaEliminando.fecha)} a las{' '}
              {citaEliminando.hora}. Esta acción no se puede deshacer.
            </p>

            {errorEliminar && (
              <p className="text-xs text-red-500 mb-3 bg-red-50
                rounded-lg p-2">{errorEliminar}</p>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setCitaEliminando(null)
                  setErrorEliminar('')
                }}
                className="flex-1 py-2.5 rounded-xl border
                  border-gray-200 text-sm text-gray-600
                  hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={eliminarCita}
                disabled={eliminando}
                className="flex-1 py-2.5 rounded-xl bg-red-500
                  hover:bg-red-600 disabled:bg-red-300
                  text-white text-sm font-medium transition-colors"
              >
                {eliminando ? 'Eliminando...' : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Mini-calendario propio (con puntos en días con citas) ─────
// Reemplaza al datepicker nativo del navegador, que no puede
// personalizarse para mostrar indicadores por día.
function MiniCalendario({
  fechaSeleccionada,
  onSeleccionar,
  onCerrar,
  fechasConCitas,
}: {
  fechaSeleccionada: string
  onSeleccionar: (fecha: string) => void
  onCerrar: () => void
  fechasConCitas: Set<string>
}) {
  const hoyStr = getHoyStr()
  const base = fechaSeleccionada
    ? parseDateLocal(fechaSeleccionada)
    : parseDateLocal(hoyStr)

  const [mesActual, setMesActual] = useState(base.getMonth())
  const [anioActual, setAnioActual] = useState(base.getFullYear())

  const nombreMes = new Date(anioActual, mesActual, 1)
    .toLocaleDateString('es-PE', { month: 'long', year: 'numeric' })

  const primerDiaSemana = new Date(anioActual, mesActual, 1).getDay()
  const diasEnMes = new Date(anioActual, mesActual + 1, 0).getDate()
  const diasMesAnterior = new Date(anioActual, mesActual, 0).getDate()

  const celdas: { dia: number; mes: number; anio: number; fueraDeMes: boolean }[] = []

  for (let i = primerDiaSemana - 1; i >= 0; i--) {
    celdas.push({
      dia: diasMesAnterior - i, mes: mesActual - 1,
      anio: anioActual, fueraDeMes: true
    })
  }
  for (let d = 1; d <= diasEnMes; d++) {
    celdas.push({ dia: d, mes: mesActual, anio: anioActual, fueraDeMes: false })
  }
  let siguiente = 1
  while (celdas.length % 7 !== 0) {
    celdas.push({
      dia: siguiente, mes: mesActual + 1,
      anio: anioActual, fueraDeMes: true
    })
    siguiente++
  }

  function irMesAnterior() {
    if (mesActual === 0) {
      setMesActual(11)
      setAnioActual(a => a - 1)
    } else {
      setMesActual(m => m - 1)
    }
  }

  function irMesSiguiente() {
    if (mesActual === 11) {
      setMesActual(0)
      setAnioActual(a => a + 1)
    } else {
      setMesActual(m => m + 1)
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-30" onClick={onCerrar} />
      <div className="absolute top-full left-0 mt-1 bg-white
        border border-gray-200 rounded-xl shadow-lg z-40 p-3 w-72">
        <div className="flex items-center justify-between mb-2">
          <button
            type="button"
            onClick={irMesAnterior}
            className="w-7 h-7 flex items-center justify-center
              text-gray-500 hover:bg-gray-100 rounded-lg"
          >
            ‹
          </button>
          <p className="text-sm font-semibold text-gray-700 capitalize">
            {nombreMes}
          </p>
          <button
            type="button"
            onClick={irMesSiguiente}
            className="w-7 h-7 flex items-center justify-center
              text-gray-500 hover:bg-gray-100 rounded-lg"
          >
            ›
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1 mb-1">
          {['DO', 'LU', 'MA', 'MI', 'JU', 'VI', 'SA'].map(d => (
            <div key={d}
              className="text-[10px] text-gray-400 text-center font-medium">
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {celdas.map((c, i) => {
            const fechaReal = new Date(c.anio, c.mes, c.dia)
            const fechaStr = `${fechaReal.getFullYear()}-${pad2(fechaReal.getMonth() + 1)}-${pad2(fechaReal.getDate())}`
            const esHoy = fechaStr === hoyStr
            const esSeleccionada = fechaStr === fechaSeleccionada
            const tieneCitas = fechasConCitas.has(fechaStr)

            return (
              <button
                key={i}
                type="button"
                onClick={() => { onSeleccionar(fechaStr); onCerrar() }}
                className={`relative h-8 rounded-lg text-xs
                  flex items-center justify-center transition-colors
                  ${c.fueraDeMes ? 'text-gray-300' : 'text-gray-700'}
                  ${esSeleccionada
                    ? 'bg-primary-600 text-white font-semibold'
                    : ''}
                  ${!esSeleccionada && esHoy
                    ? 'border border-primary-400 font-semibold'
                    : ''}
                  ${!esSeleccionada ? 'hover:bg-gray-100' : ''}
                `}
              >
                {c.dia}
                {tieneCitas && (
                  <span className={`absolute bottom-1 w-1 h-1
                    rounded-full
                    ${esSeleccionada ? 'bg-white' : 'bg-primary-500'}`}
                  />
                )}
              </button>
            )
          })}
        </div>

        <div className="flex justify-between mt-2 pt-2 border-t border-gray-100">
          <button
            type="button"
            onClick={() => { onSeleccionar(''); onCerrar() }}
            className="text-xs text-gray-400 hover:text-gray-600"
          >
            Borrar filtro
          </button>
          <button
            type="button"
            onClick={() => { onSeleccionar(hoyStr); onCerrar() }}
            className="text-xs text-primary-600 hover:text-primary-700 font-medium"
          >
            Hoy
          </button>
        </div>
      </div>
    </>
  )
}

// Componente tarjeta de cita
function CitaCard({
  cita,
  onCambiarEstado,
  onEditar,
  onEliminar,
  highlight = false,
}: {
  cita: Cita
  onCambiarEstado: (
    id: string,
    estado: 'atendida' | 'cancelada' | 'pendiente'
  ) => void
  onEditar: (cita: Cita) => void
  onEliminar: (cita: Cita) => void
  highlight?: boolean
}) {
  const [mostrarOpciones, setMostrarOpciones] = useState(false)

  function formatFechaCita(fecha: string): string {
    if (!fecha) return '—'
    const date = parseDateLocal(fecha)
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
                  <button
                    onClick={() => {
                      onEditar(cita)
                      setMostrarOpciones(false)
                    }}
                    className="w-full text-left px-4 py-2.5 text-sm
                      text-gray-600 hover:bg-gray-50 transition-colors
                      border-b border-gray-50"
                  >
                    ✎ Editar cita
                  </button>
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
                        text-red-500 hover:bg-red-50 transition-colors
                        border-b border-gray-50"
                    >
                      ✕ Cancelar cita
                    </button>
                  )}
                  <button
                    onClick={() => {
                      onEliminar(cita)
                      setMostrarOpciones(false)
                    }}
                    className="w-full text-left px-4 py-2.5 text-sm
                      text-red-600 hover:bg-red-50 transition-colors"
                  >
                    🗑 Eliminar cita
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}