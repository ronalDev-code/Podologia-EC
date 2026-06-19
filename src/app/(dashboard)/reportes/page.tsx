'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  collection, query, where, getDocs,
  Timestamp, orderBy
} from 'firebase/firestore'
import { db } from '@/lib/firebase'

interface ResumenMes {
  totalIngresos: number
  totalEfectivo: number
  totalTarjeta: number
  totalTransferencia: number
  totalYape: number
  totalPlin: number
  totalAtenciones: number
  cajasDelMes: number
}

interface TratamientoCount {
  tipo: string
  count: number
}

interface PacienteStats {
  nuevos: number
  recurrentes: number
}

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
]

const tratamientoLabel: Record<string, string> = {
  quiropodia: 'Quiropodia',
  fresado: 'Fresado',
  curacion: 'Curación',
  corteUnas: 'Corte de uñas',
  otro: 'Otro',
  placa_antimicotica: 'Placa antimicótica',
  ozono: 'Ozono',
  laser: 'Láser',
}

export default function ReportesPage() {
  const now = new Date()
  const [mes, setMes] = useState(now.getMonth())
  const [anio, setAnio] = useState(now.getFullYear())
  const [loading, setLoading] = useState(false)

  const [resumen, setResumen] = useState<ResumenMes | null>(null)
  const [tratamientos, setTratamientos] = useState<TratamientoCount[]>([])
  const [pacienteStats, setPacienteStats] = useState<PacienteStats | null>(null)

  const cargarReporte = useCallback(async () => {
    setLoading(true)
    try {
      const inicio = new Date(anio, mes, 1)
      const fin = new Date(anio, mes + 1, 0, 23, 59, 59)

      // ── CAJAS DEL MES ──────────────────────────────
      const qCajas = query(
        collection(db, 'cajas'),
        where('fecha', '>=', Timestamp.fromDate(inicio)),
        where('fecha', '<=', Timestamp.fromDate(fin)),
        orderBy('fecha', 'asc')
      )
      const cajasSnap = await getDocs(qCajas)

      let totalIngresos = 0
      let totalEfectivo = 0
      let totalTarjeta = 0
      let totalTransferencia = 0
      let totalYape = 0
      let totalPlin = 0
      let totalAtenciones = 0

      cajasSnap.docs.forEach(d => {
        const data = d.data()
        totalIngresos += data.totalGeneral || 0
        totalEfectivo += data.totalEfectivo || 0
        totalTarjeta += data.totalTarjeta || 0
        totalTransferencia += data.totalTransferencia || 0
        totalYape += data.totalYape || 0
        totalPlin += data.totalPlin || 0
        totalAtenciones += (data.cobros || []).length
      })

      setResumen({
        totalIngresos, totalEfectivo, totalTarjeta,
        totalTransferencia, totalYape, totalPlin,
        totalAtenciones, cajasDelMes: cajasSnap.size
      })

      // ── TRATAMIENTOS DEL MES ────────────────────────
      const qEvol = query(
        collection(db, 'evoluciones'),
        where('fecha', '>=', Timestamp.fromDate(inicio)),
        where('fecha', '<=', Timestamp.fromDate(fin)),
        orderBy('fecha', 'asc')
      )
      const evolSnap = await getDocs(qEvol)

      const conteo: Record<string, number> = {}
      evolSnap.docs.forEach(d => {
        const data = d.data()
        const tratams = data.tratamientosAplicados || []
        tratams.forEach((t: { tipo: string }) => {
          conteo[t.tipo] = (conteo[t.tipo] || 0) + 1
        })
        const sesiones = data.sesionesEspeciales || []
        sesiones.forEach((s: { tipo: string }) => {
          conteo[s.tipo] = (conteo[s.tipo] || 0) + 1
        })
      })

      const tratArray = Object.entries(conteo)
        .map(([tipo, count]) => ({ tipo, count }))
        .sort((a, b) => b.count - a.count)
      setTratamientos(tratArray)

      // ── PACIENTES NUEVOS VS RECURRENTES ─────────────
      const pacientesIds = new Set<string>()
      evolSnap.docs.forEach(d => {
        const pid = d.data().pacienteId
        if (pid) pacientesIds.add(pid)
      })

      // Pacientes registrados este mes
      const qPacNuevos = query(
        collection(db, 'pacientes'),
        where('fechaRegistro', '>=', Timestamp.fromDate(inicio)),
        where('fechaRegistro', '<=', Timestamp.fromDate(fin))
      )
      const pacNuevosSnap = await getDocs(qPacNuevos)
      const nuevosIds = new Set(pacNuevosSnap.docs.map(d => d.id))
      const nuevos = [...pacientesIds].filter(id => nuevosIds.has(id)).length
      const recurrentes = pacientesIds.size - nuevos

      setPacienteStats({ nuevos, recurrentes })

    } finally {
      setLoading(false)
    }
  }, [mes, anio])

  useEffect(() => { cargarReporte() }, [cargarReporte])

  function aniosPosibles() {
  const inicio = 2026 // año de inicio del negocio
  const actual = new Date().getFullYear()
  const anos = []
  for (let a = inicio; a <= actual + 1; a++) {
    anos.push(a)
  }
  return anos
}

  async function exportarPDF() {
  if (!resumen || !pacienteStats) return
  const { generarPDFReporte } = await import('@/lib/pdf-utils')
  await generarPDFReporte(
    mes, anio, MESES, resumen,
    tratamientos, pacienteStats, tratamientoLabel
  )
}

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-800">
            Reportes
          </h1>
          <p className="text-sm text-gray-500">
            Resumen mensual del consultorio
          </p>
        </div>
        <button
          onClick={exportarPDF}
          disabled={!resumen || loading}
          className="inline-flex items-center gap-2 bg-primary-600
            hover:bg-primary-700 disabled:bg-primary-300 text-white
            text-sm font-medium px-4 py-2.5 rounded-lg transition-colors"
        >
          📄 PDF
        </button>
      </div>

      {/* Selector mes/año */}
      <div className="flex gap-3 mb-6">
        <select
          value={mes}
          onChange={e => setMes(Number(e.target.value))}
          className="input-field flex-1"
        >
          {MESES.map((m, i) => (
            <option key={m} value={i}>{m}</option>
          ))}
        </select>
        <select
          value={anio}
          onChange={e => setAnio(Number(e.target.value))}
          className="input-field w-28"
        >
          {aniosPosibles().map(a => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i}
              className="h-24 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-4">

          {/* Ingresos totales */}
          <div className="bg-primary-600 rounded-2xl p-5 text-white">
            <p className="text-primary-200 text-xs font-medium mb-1">
              Total ingresos — {MESES[mes]} {anio}
            </p>
            <p className="text-3xl font-bold mb-1">
              S/ {(resumen?.totalIngresos || 0).toFixed(2)}
            </p>
            <p className="text-primary-200 text-sm">
              {resumen?.totalAtenciones || 0} atenciones ·{' '}
              {resumen?.cajasDelMes || 0} días trabajados
            </p>
          </div>

          {/* Desglose por medio de pago */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">
              Ingresos por medio de pago
            </h2>
            <div className="space-y-3">
              {[
                { label: '💵 Efectivo', val: resumen?.totalEfectivo || 0 },
                { label: '💳 Tarjeta', val: resumen?.totalTarjeta || 0 },
                { label: '🏦 Transferencia', val: resumen?.totalTransferencia || 0 },
                { label: '📱 Yape', val: resumen?.totalYape || 0 },
                { label: '📱 Plin', val: resumen?.totalPlin || 0 },
              ].map(item => {
                const total = resumen?.totalIngresos || 1
                const pct = total > 0
                  ? Math.round((item.val / total) * 100) : 0
                return (
                  <div key={item.label}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600">{item.label}</span>
                      <span className="font-medium text-gray-800">
                        S/ {item.val.toFixed(2)}
                        <span className="text-gray-400 font-normal ml-1">
                          ({pct}%)
                        </span>
                      </span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full">
                      <div
                        className="h-1.5 bg-primary-500 rounded-full
                          transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Tratamientos */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">
              Tratamientos realizados
            </h2>
            {tratamientos.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">
                Sin tratamientos este mes
              </p>
            ) : (
              <div className="space-y-2">
                {tratamientos.map((t, i) => {
                  const max = tratamientos[0].count
                  const pct = Math.round((t.count / max) * 100)
                  return (
                    <div key={t.tipo}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-600">
                          {tratamientoLabel[t.tipo] || t.tipo}
                        </span>
                        <span className="font-medium text-gray-800">
                          {t.count} {t.count === 1
                            ? 'vez' : 'veces'}
                        </span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full">
                        <div
                          className="h-1.5 rounded-full transition-all
                            duration-500"
                          style={{
                            width: `${pct}%`,
                            backgroundColor: i === 0
                              ? '#0F6E56' : '#5DCAA5'
                          }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Pacientes */}
          {pacienteStats && (
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <h2 className="text-sm font-semibold text-gray-700 mb-4">
                Pacientes del mes
              </h2>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-2xl font-bold text-gray-800">
                    {pacienteStats.nuevos + pacienteStats.recurrentes}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">Total</p>
                </div>
                <div className="bg-primary-50 rounded-xl p-3">
                  <p className="text-2xl font-bold text-primary-600">
                    {pacienteStats.nuevos}
                  </p>
                  <p className="text-xs text-primary-400 mt-1">Nuevos</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-2xl font-bold text-gray-600">
                    {pacienteStats.recurrentes}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">Recurrentes</p>
                </div>
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  )
}