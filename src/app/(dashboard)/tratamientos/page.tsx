'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  collection, query, orderBy, limit,
  startAfter, getDocs, DocumentSnapshot,
  doc, getDoc, updateDoc
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface SesionItem {
  numero: number
  fecha: string | null
  estado: string
  observacion: string
}

interface SesionEspecial {
  tipo: string
  sesiones: SesionItem[]
}

interface EvolucionConPaciente {
  id: string
  pacienteId: string
  fecha: unknown
  sesionesEspeciales: SesionEspecial[]
  pacienteNombre: string
}

const tratamientoLabel: Record<string, string> = {
  placa_antimicotica: 'Placa antimicótica',
  ozono: 'Ozono',
  laser: 'Láser',
}

const PAGE_SIZE = 20

export default function TratamientosPage() {
  const router = useRouter()
  const [items, setItems] = useState<EvolucionConPaciente[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMas, setLoadingMas] = useState(false)
  const [ultimoDoc, setUltimoDoc] =
    useState<DocumentSnapshot | null>(null)
  const [hayMas, setHayMas] = useState(false)
  const [filtroTipo, setFiltroTipo] = useState<string>('todos')
  const [filtroPendiente, setFiltroPendiente] = useState(false)

  const cargar = useCallback(async () => {
    setLoading(true)
    try {
      const q = query(
        collection(db, 'evoluciones'),
        orderBy('fecha', 'desc'),
        limit(PAGE_SIZE)
      )
      const snap = await getDocs(q)

      // Obtener IDs de pacientes únicos para batch
      const pacienteIds = [...new Set(
        snap.docs
          .filter(d => (d.data().sesionesEspeciales || []).length > 0)
          .map(d => d.data().pacienteId)
          .filter(Boolean)
      )]

      // Cargar pacientes en paralelo
      const pacientesMap = new Map<string, string>()
      await Promise.all(
        pacienteIds.map(async pid => {
          const ps = await getDoc(doc(db, 'pacientes', pid))
          if (ps.exists()) {
            const p = ps.data()
            pacientesMap.set(pid, `${p.nombre} ${p.apellido}`)
          }
        })
      )

      const data = snap.docs
        .filter(d => (d.data().sesionesEspeciales || []).length > 0)
        .map(d => {
          const ev = { id: d.id, ...d.data() } as EvolucionConPaciente
          ev.pacienteNombre = pacientesMap.get(ev.pacienteId) || '—'
          return ev
        })

      setItems(data)
      setUltimoDoc(snap.docs[snap.docs.length - 1] ?? null)
      setHayMas(snap.docs.length === PAGE_SIZE)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { cargar() }, [cargar])

  async function cargarMas() {
    if (!ultimoDoc || loadingMas) return
    setLoadingMas(true)
    try {
      const q = query(
        collection(db, 'evoluciones'),
        orderBy('fecha', 'desc'),
        startAfter(ultimoDoc),
        limit(PAGE_SIZE)
      )
      const snap = await getDocs(q)

      const pacienteIds = [...new Set(
        snap.docs
          .filter(d => (d.data().sesionesEspeciales || []).length > 0)
          .map(d => d.data().pacienteId)
          .filter(Boolean)
      )]

      const pacientesMap = new Map<string, string>()
      await Promise.all(
        pacienteIds.map(async pid => {
          const ps = await getDoc(doc(db, 'pacientes', pid))
          if (ps.exists()) {
            const p = ps.data()
            pacientesMap.set(pid, `${p.nombre} ${p.apellido}`)
          }
        })
      )

      const data = snap.docs
        .filter(d => (d.data().sesionesEspeciales || []).length > 0)
        .map(d => {
          const ev = { id: d.id, ...d.data() } as EvolucionConPaciente
          ev.pacienteNombre = pacientesMap.get(ev.pacienteId) || '—'
          return ev
        })

      setItems(prev => [...prev, ...data])
      setUltimoDoc(snap.docs[snap.docs.length - 1] ?? null)
      setHayMas(snap.docs.length === PAGE_SIZE)
    } finally {
      setLoadingMas(false)
    }
  }

  async function marcarSesion(
    evolucionId: string,
    tipoTratamiento: string,
    numeroSesion: number,
    nuevoEstado: string
  ) {
    try {
      const evRef = doc(db, 'evoluciones', evolucionId)
      const evSnap = await getDoc(evRef)
      if (!evSnap.exists()) return

      const sesionesEspeciales =
        evSnap.data().sesionesEspeciales || []
      const actualizadas = sesionesEspeciales.map(
        (s: SesionEspecial) => {
          if (s.tipo !== tipoTratamiento) return s
          return {
            ...s,
            sesiones: s.sesiones.map((ses: SesionItem) =>
              ses.numero === numeroSesion
                ? { ...ses, estado: nuevoEstado }
                : ses
            )
          }
        }
      )

      await updateDoc(evRef, { sesionesEspeciales: actualizadas })

      setItems(prev => prev.map(item => {
        if (item.id !== evolucionId) return item
        return { ...item, sesionesEspeciales: actualizadas }
      }))
    } catch {
      console.error('Error al actualizar sesión')
    }
  }

  function formatFecha(fecha: unknown): string {
    if (!fecha) return '—'
    try {
      const ts = fecha as { toDate?: () => Date }
      const d = ts.toDate
        ? ts.toDate()
        : new Date(fecha as string)
      return d.toLocaleDateString('es-PE', {
        day: '2-digit', month: 'short', year: 'numeric'
      })
    } catch { return '—' }
  }

  function formatFechaSesion(fecha: string | null): string {
    if (!fecha) return '—'
    const [y, m, d] = fecha.split('-')
    return `${d}/${m}/${y}`
  }

  const itemsFiltrados = items.filter(item => {
    const sesiones = item.sesionesEspeciales || []
    if (filtroTipo !== 'todos') {
      if (!sesiones.some(s => s.tipo === filtroTipo)) return false
    }
    if (filtroPendiente) {
      const tienePendiente = sesiones.some(s =>
        s.sesiones?.some(ses => ses.estado === 'pendiente')
      )
      if (!tienePendiente) return false
    }
    return true
  })

  const totalPendientes = items.reduce((acc, item) => {
    return acc + (item.sesionesEspeciales || []).reduce((a, s) => {
      return a + (s.sesiones || []).filter(
        ses => ses.estado === 'pendiente'
      ).length
    }, 0)
  }, 0)

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-800">
            Tratamientos
          </h1>
          <p className="text-sm text-gray-500">
            Seguimiento de sesiones especiales
          </p>
        </div>
        {totalPendientes > 0 && (
          <span className="bg-amber-100 text-amber-700 text-xs
            font-semibold px-2.5 py-1.5 rounded-full">
            {totalPendientes} pendientes
          </span>
        )}
      </div>

      {/* Filtros */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {[
          { value: 'todos', label: 'Todos' },
          { value: 'placa_antimicotica', label: 'Placas' },
          { value: 'ozono', label: 'Ozono' },
          { value: 'laser', label: 'Láser' },
        ].map(f => (
          <button
            key={f.value}
            onClick={() => setFiltroTipo(f.value)}
            className={`px-3 py-1.5 rounded-full text-xs
              font-medium border transition-all
              ${filtroTipo === f.value
                ? 'bg-primary-600 text-white border-primary-600'
                : 'bg-white text-gray-600 border-gray-200'
              }`}
          >
            {f.label}
          </button>
        ))}
        <button
          onClick={() => setFiltroPendiente(!filtroPendiente)}
          className={`px-3 py-1.5 rounded-full text-xs
            font-medium border transition-all
            ${filtroPendiente
              ? 'bg-amber-500 text-white border-amber-500'
              : 'bg-white text-gray-600 border-gray-200'
            }`}
        >
          ⏳ Pendientes
        </button>
      </div>

      {/* Lista */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i}
              className="h-32 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : itemsFiltrados.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-4xl mb-3">🩺</p>
          <p className="text-gray-500 text-sm">
            {filtroPendiente || filtroTipo !== 'todos'
              ? 'No hay tratamientos con ese filtro'
              : 'No hay tratamientos con sesiones'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {itemsFiltrados.map(item => (
            <div key={item.id}
              className="bg-white rounded-2xl border border-gray-100
                overflow-hidden">

              {/* Header tarjeta */}
              <div className="flex items-center justify-between
                px-4 py-3 border-b border-gray-50 gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-primary-50
                    flex items-center justify-center text-primary-600
                    font-semibold text-xs flex-shrink-0">
                    {item.pacienteNombre?.charAt(0) || '?'}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800
                      truncate">
                      {item.pacienteNombre || 'Paciente'}
                    </p>
                    <p className="text-xs text-gray-400">
                      {formatFecha(item.fecha)}
                    </p>
                  </div>
                </div>
                <Link
                  href={`/evolucion/${item.id}`}
                  className="text-xs text-primary-600
                    hover:text-primary-700 font-medium flex-shrink-0"
                >
                  Ver →
                </Link>
              </div>

              {/* Sesiones */}
              <div className="p-3 space-y-4">
                {(item.sesionesEspeciales || [])
                  .filter(s =>
                    filtroTipo === 'todos' || s.tipo === filtroTipo
                  )
                  .map((sesion, si) => {
                    const realizadas = sesion.sesiones?.filter(
                      s => s.estado === 'realizado'
                    ).length || 0
                    const total = sesion.sesiones?.length || 0

                    return (
                      <div key={si}>
                        {/* Título + progreso */}
                        <div className="flex items-center
                          justify-between mb-1.5">
                          <p className="text-xs font-semibold
                            text-primary-600 uppercase tracking-wide">
                            {tratamientoLabel[sesion.tipo] ||
                              sesion.tipo}
                          </p>
                          <span className="text-xs text-gray-400">
                            {realizadas}/{total}
                          </span>
                        </div>

                        {/* Barra progreso */}
                        <div className="h-1.5 bg-gray-100
                          rounded-full mb-2">
                          <div
                            className="h-1.5 bg-primary-500
                              rounded-full transition-all duration-500"
                            style={{
                              width: total > 0
                                ? `${(realizadas / total) * 100}%`
                                : '0%'
                            }}
                          />
                        </div>

                        {/* Sesiones — diseño móvil optimizado */}
                        <div className="space-y-1">
                          {sesion.sesiones?.map((ses, i) => (
                            <div key={i}
                              className={`flex items-center
                                gap-2 p-2 rounded-lg
                                ${ses.estado === 'realizado'
                                  ? 'bg-green-50'
                                  : 'bg-gray-50'}`}>

                              {/* Número */}
                              <span className={`w-5 h-5 rounded-full
                                flex items-center justify-center
                                text-[10px] font-bold flex-shrink-0
                                ${ses.estado === 'realizado'
                                  ? 'bg-green-500 text-white'
                                  : 'bg-gray-200 text-gray-500'}`}>
                                {ses.numero}
                              </span>

                              {/* Info — ocupa el espacio disponible */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center
                                  gap-1.5 flex-wrap">
                                  <span className={`text-xs
                                    font-medium
                                    ${ses.estado === 'realizado'
                                      ? 'text-green-600'
                                      : 'text-amber-500'}`}>
                                    {ses.estado === 'realizado'
                                      ? '✓ Listo'
                                      : 'Pendiente'}
                                  </span>
                                  {ses.fecha && (
                                    <span className="text-xs
                                      text-gray-400">
                                      {formatFechaSesion(ses.fecha)}
                                    </span>
                                  )}
                                </div>
                                {ses.observacion && (
                                  <p className="text-[10px]
                                    text-gray-400 truncate mt-0.5">
                                    {ses.observacion}
                                  </p>
                                )}
                              </div>

                              {/* Botón marcar */}
                              <button
                                onClick={() => marcarSesion(
                                  item.id,
                                  sesion.tipo,
                                  ses.numero,
                                  ses.estado === 'realizado'
                                    ? 'pendiente'
                                    : 'realizado'
                                )}
                                className={`flex-shrink-0 text-[10px]
                                  px-2 py-1 rounded-lg font-medium
                                  transition-colors
                                  ${ses.estado === 'realizado'
                                    ? 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                                    : 'bg-primary-100 text-primary-600 hover:bg-primary-200'
                                  }`}
                              >
                                {ses.estado === 'realizado'
                                  ? 'Desmarcar'
                                  : 'Marcar'}
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })}
              </div>
            </div>
          ))}

          {hayMas && (
            <button
              onClick={cargarMas}
              disabled={loadingMas}
              className="w-full py-3 text-sm text-primary-600
                hover:text-primary-700 font-medium
                transition-colors disabled:opacity-50"
            >
              {loadingMas ? 'Cargando...' : 'Cargar más'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}