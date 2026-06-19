'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import {
  collection, query, where, orderBy, limit,
  startAfter, getDocs, DocumentSnapshot,
  Timestamp
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { Evolucion, Paciente } from '@/types'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

const PAGE_SIZE = 20

const medioPagoLabel: Record<string, string> = {
  efectivo: '💵 Efectivo',
  tarjeta: '💳 Tarjeta',
  transferencia: '🏦 Transferencia',
  yape: '📱 Yape',
  plin: '📱 Plin',
}

function EvolucionContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const pacienteId = searchParams.get('pacienteId') || ''

  const [evoluciones, setEvoluciones] = useState<Evolucion[]>([])
  const [paciente, setPaciente] = useState<Paciente | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMas, setLoadingMas] = useState(false)
  const [ultimoDoc, setUltimoDoc] = useState<DocumentSnapshot | null>(null)
  const [hayMas, setHayMas] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const [filtroMes, setFiltroMes] = useState('')

  const cargar = useCallback(async () => {
    setLoading(true)
    try {
      if (pacienteId) {
        const { doc, getDoc } = await import('firebase/firestore')
        const ps = await getDoc(doc(db, 'pacientes', pacienteId))
        if (ps.exists())
          setPaciente({ id: ps.id, ...ps.data() } as Paciente)
      }

      const constraints: Parameters<typeof query>[1][] = []
      if (pacienteId) {
        constraints.push(where('pacienteId', '==', pacienteId))
      }
      if (filtroMes) {
        const [anio, mes] = filtroMes.split('-').map(Number)
        const inicio = new Date(anio, mes - 1, 1)
        const fin = new Date(anio, mes, 0, 23, 59, 59)
        constraints.push(
          where('fecha', '>=', Timestamp.fromDate(inicio))
        )
        constraints.push(
          where('fecha', '<=', Timestamp.fromDate(fin))
        )
      }
      constraints.push(orderBy('fecha', 'desc'))
      constraints.push(limit(PAGE_SIZE))

      const q = query(collection(db, 'evoluciones'), ...constraints)
      const snap = await getDocs(q)
      const data = snap.docs.map(d => ({
        id: d.id, ...d.data()
      })) as Evolucion[]
      setEvoluciones(data)
      setUltimoDoc(snap.docs[snap.docs.length - 1] ?? null)
      setHayMas(snap.docs.length === PAGE_SIZE)
    } finally {
      setLoading(false)
    }
  }, [pacienteId, filtroMes])

  useEffect(() => { cargar() }, [cargar])

  async function cargarMas() {
    if (!ultimoDoc || loadingMas) return
    setLoadingMas(true)
    try {
      const constraints: Parameters<typeof query>[1][] = []
      if (pacienteId)
        constraints.push(where('pacienteId', '==', pacienteId))
      constraints.push(orderBy('fecha', 'desc'))
      constraints.push(startAfter(ultimoDoc))
      constraints.push(limit(PAGE_SIZE))

      const q = query(collection(db, 'evoluciones'), ...constraints)
      const snap = await getDocs(q)
      const data = snap.docs.map(d => ({
        id: d.id, ...d.data()
      })) as Evolucion[]
      setEvoluciones(prev => [...prev, ...data])
      setUltimoDoc(snap.docs[snap.docs.length - 1] ?? null)
      setHayMas(snap.docs.length === PAGE_SIZE)
    } finally {
      setLoadingMas(false)
    }
  }

  function formatFecha(fecha: unknown): string {
    if (!fecha) return '—'
    try {
      const ts = fecha as { toDate?: () => Date }
      const d = ts.toDate ? ts.toDate() : new Date(fecha as string)
      return d.toLocaleDateString('es-PE', {
        day: '2-digit', month: 'short', year: 'numeric'
      })
    } catch { return '—' }
  }

  // Filtro local por búsqueda de nota
  const evolucionesFiltradas = evoluciones.filter(ev => {
    if (!busqueda.trim()) return true
    const t = busqueda.toLowerCase()
    return ev.notaClinica?.toLowerCase().includes(t) ||
      ev.cobro?.concepto?.toLowerCase().includes(t)
  })

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">

      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        {pacienteId && (
          <button
            onClick={() => router.push(`/pacientes/${pacienteId}`)}
            className="text-gray-400 hover:text-gray-600
              transition-colors text-lg"
          >←</button>
        )}
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-semibold text-gray-800">
            Evoluciones
          </h1>
          {paciente ? (
            <p className="text-sm text-gray-500">
              {paciente.nombre} {paciente.apellido}
              · DNI {paciente.dni}
            </p>
          ) : (
            <p className="text-sm text-gray-500">
              Todas las evoluciones
            </p>
          )}
        </div>
        <Link
          href={pacienteId
            ? `/evolucion/nueva?pacienteId=${pacienteId}`
            : '/evolucion/seleccionar-paciente'}
          className="inline-flex items-center gap-1.5 bg-primary-600
            hover:bg-primary-700 text-white text-sm font-medium
            px-3 py-2.5 rounded-lg transition-colors"
        >
          <span>+</span> Nueva
        </Link>
      </div>

      {/* Filtros */}
      <div className="flex gap-2 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-0">
          <span className="absolute left-3 top-1/2 -translate-y-1/2
            text-gray-400 text-sm">🔍</span>
          <input
            type="text"
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar en notas..."
            className="w-full pl-9 pr-3 py-2 rounded-lg border
              border-gray-200 text-sm focus:outline-none
              focus:ring-2 focus:ring-primary-500 bg-white"
          />
        </div>
        <input
          type="month"
          value={filtroMes}
          onChange={e => setFiltroMes(e.target.value)}
          className="input-field w-auto text-sm py-2"
        />
        {filtroMes && (
          <button
            onClick={() => setFiltroMes('')}
            className="text-xs text-gray-400 hover:text-gray-600
              px-2 py-2 rounded-lg border border-gray-200 bg-white"
          >
            ✕ Limpiar
          </button>
        )}
      </div>

      {/* Lista */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i}
              className="h-24 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : evolucionesFiltradas.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-4xl mb-3">📋</p>
          <p className="text-gray-500 text-sm">
            {busqueda || filtroMes
              ? 'No hay resultados con ese filtro'
              : 'No hay evoluciones registradas'}
          </p>
          {!busqueda && !filtroMes && (
            <Link
              href={pacienteId
                ? `/evolucion/nueva?pacienteId=${pacienteId}`
                : '/evolucion/seleccionar-paciente'}
              className="inline-block mt-4 text-sm text-primary-600
                hover:text-primary-700 font-medium"
            >
              Registrar primera evolución →
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {evolucionesFiltradas.map((evolucion, index) => (
            <Link
              key={evolucion.id}
              href={`/evolucion/${evolucion.id}`}
              className="block bg-white border border-gray-100
                rounded-xl p-4 hover:border-primary-200
                hover:shadow-sm transition-all group"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-primary-50
                    flex items-center justify-center text-primary-600
                    text-xs font-bold flex-shrink-0 mt-0.5">
                    {evolucionesFiltradas.length - index}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2
                      flex-wrap mb-1">
                      <p className="text-sm font-medium text-gray-800">
                        {formatFecha(evolucion.fecha)}
                      </p>
                      {evolucion.cobro?.monto > 0 && (
                        <span className="text-xs bg-green-50
                          text-green-700 px-2 py-0.5 rounded-full
                          font-medium">
                          S/ {evolucion.cobro.monto.toFixed(2)}
                        </span>
                      )}
                      {evolucion.cobro?.medioPago && (
                        <span className="text-xs text-gray-400">
                          {medioPagoLabel[evolucion.cobro.medioPago]}
                        </span>
                      )}
                    </div>
                    {evolucion.notaClinica && (
                      <p className="text-xs text-gray-500 line-clamp-2">
                        {evolucion.notaClinica}
                      </p>
                    )}
                    {evolucion.tratamientosAplicados?.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {evolucion.tratamientosAplicados.map((t, i) => (
                          <span key={i} className="text-[10px]
                            bg-gray-100 text-gray-600 px-2 py-0.5
                            rounded-full">
                            {t.tipo}
                          </span>
                        ))}
                      </div>
                    )}
                    {(evolucion.fotos?.antes ||
                      evolucion.fotos?.intermedio ||
                      evolucion.fotos?.despues) && (
                      <p className="text-[10px] text-gray-400 mt-1.5">
                        📷 Fotos adjuntas
                      </p>
                    )}
                  </div>
                </div>
                <span className="text-gray-300
                  group-hover:text-primary-400 transition-colors
                  flex-shrink-0">→</span>
              </div>
            </Link>
          ))}

          {hayMas && (
            <button
              onClick={cargarMas}
              disabled={loadingMas}
              className="w-full py-3 text-sm text-primary-600
                hover:text-primary-700 font-medium transition-colors
                disabled:opacity-50"
            >
              {loadingMas ? 'Cargando...' : 'Cargar más evoluciones'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export default function EvolucionPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-2 border-primary-600
          border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <EvolucionContent />
    </Suspense>
  )
}