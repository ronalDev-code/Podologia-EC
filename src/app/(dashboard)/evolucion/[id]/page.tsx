'use client'

import { useState, useEffect } from 'react'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { Evolucion, Paciente } from '@/types'
import { useRouter, useParams } from 'next/navigation'
import Image from 'next/image'

const medioPagoLabel: Record<string, string> = {
  efectivo: '💵 Efectivo',
  tarjeta: '💳 Tarjeta',
  transferencia: '🏦 Transferencia',
  yape: '📱 Yape',
  plin: '📱 Plin',
}

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

export default function DetalleEvolucionPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [evolucion, setEvolucion] = useState<Evolucion | null>(null)
  const [paciente, setPaciente] = useState<Paciente | null>(null)
  const [loading, setLoading] = useState(true)
  const [fotoAmpliada, setFotoAmpliada] = useState<string | null>(null)

  useEffect(() => {
    async function cargar() {
      try {
        const snap = await getDoc(doc(db, 'evoluciones', id))
        if (!snap.exists()) { router.push('/evolucion'); return }
        const data = { id: snap.id, ...snap.data() } as Evolucion
        setEvolucion(data)
        if (data.pacienteId) {
          const pacSnap = await getDoc(doc(db, 'pacientes', data.pacienteId))
          if (pacSnap.exists()) {
            setPaciente({ id: pacSnap.id, ...pacSnap.data() } as Paciente)
          }
        }
      } finally {
        setLoading(false)
      }
    }
    cargar()
  }, [id, router])

  function formatFecha(fecha: unknown): string {
    if (!fecha) return '—'
    try {
      const ts = fecha as { toDate?: () => Date }
      const date = ts.toDate ? ts.toDate() : new Date(fecha as string)
      return date.toLocaleDateString('es-PE', {
        weekday: 'long', day: '2-digit',
        month: 'long', year: 'numeric'
      })
    } catch { return '—' }
  }

  function formatFechaSesion(fecha: string | null): string {
  if (!fecha) return '—'
  const [y, m, d] = fecha.split('-')
  return `${d}/${m}/${y}`
}

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-2 border-primary-600 border-t-transparent
          rounded-full animate-spin" />
      </div>
    )
  }

  if (!evolucion) return null

  const tieneFotos = evolucion.fotos?.antes ||
    evolucion.fotos?.intermedio || evolucion.fotos?.despues

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">

      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => router.push(
            `/evolucion?pacienteId=${evolucion.pacienteId}`
          )}
          className="text-gray-400 hover:text-gray-600 transition-colors text-lg"
        >←</button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-semibold text-gray-800 capitalize">
            {formatFecha(evolucion.fecha)}
          </h1>
          {paciente && (
            <p className="text-sm text-gray-500">
              {paciente.nombre} {paciente.apellido} · DNI {paciente.dni}
            </p>
          )}
        </div>
      </div>

      <div className="space-y-4">

        {/* NOTA CLÍNICA */}
        {evolucion.notaClinica && (
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <h2 className="text-xs font-semibold text-gray-400 uppercase
              tracking-wide mb-2">Nota clínica</h2>
            <p className="text-sm text-gray-700 leading-relaxed">
              {evolucion.notaClinica}
            </p>
          </div>
        )}

        {/* MEDICAMENTOS */}
        {evolucion.medicamentos && (
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <h2 className="text-xs font-semibold text-gray-400 uppercase
              tracking-wide mb-2">Medicamentos aplicados</h2>
            <p className="text-sm text-gray-700">{evolucion.medicamentos}</p>
          </div>
        )}

        {/* TRATAMIENTOS */}
        {evolucion.tratamientosAplicados?.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <h2 className="text-xs font-semibold text-gray-400 uppercase
              tracking-wide mb-3">Tratamientos aplicados</h2>
            <div className="flex flex-wrap gap-2">
              {evolucion.tratamientosAplicados.map((t, i) => (
                <span key={i} className="bg-primary-50 text-primary-700
                  text-sm px-3 py-1.5 rounded-full font-medium">
                  {tratamientoLabel[t.tipo] || t.tipo}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* SESIONES ESPECIALES */}
        {evolucion.sesionesEspeciales?.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <h2 className="text-xs font-semibold text-gray-400 uppercase
              tracking-wide mb-4">Sesiones programadas</h2>
            {evolucion.sesionesEspeciales.map((sesion, si) => (
              <div key={si} className="mb-4 last:mb-0">
                <p className="text-sm font-semibold text-primary-600 mb-2">
                  {tratamientoLabel[sesion.tipo] || sesion.tipo}
                </p>
                <div className="space-y-1.5">
                  {sesion.sesiones?.map((ses, i) => (
                    <div key={i} className={`grid grid-cols-12 gap-2 items-center
                      py-1.5 px-2 rounded-lg text-xs
                      ${ses.estado === 'realizado'
                        ? 'bg-green-50' : 'bg-gray-50'}`}>
                      <span className="col-span-1 text-gray-400 font-medium
                        text-center">{ses.numero}</span>
                      <span className="col-span-3 text-gray-600">
                        {formatFechaSesion(ses.fecha)}
                      </span>
                      <span className={`col-span-3 font-medium
                        ${ses.estado === 'realizado'
                          ? 'text-green-600' : 'text-gray-400'}`}>
                        {ses.estado === 'realizado' ? '✓ Listo' : 'Pendiente'}
                      </span>
                      <span className="col-span-5 text-gray-500 truncate">
                        {ses.observacion || '—'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* FOTOS */}
        {tieneFotos && (
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <h2 className="text-xs font-semibold text-gray-400 uppercase
              tracking-wide mb-3">Fotografías del tratamiento</h2>
            <div className="grid grid-cols-3 gap-3">
              {[
                { url: evolucion.fotos?.antes, label: 'Antes' },
                { url: evolucion.fotos?.intermedio, label: 'Durante' },
                { url: evolucion.fotos?.despues, label: 'Después' },
              ].map((foto, i) => (
                <div key={i}>
                  <p className="text-xs text-gray-400 text-center mb-1">
                    {foto.label}
                  </p>
                  {foto.url ? (
                    <button
                      onClick={() => setFotoAmpliada(foto.url!)}
                      className="w-full aspect-square rounded-xl overflow-hidden
                        border border-gray-100 hover:border-primary-300
                        transition-colors"
                    >
                      <img
                        src={foto.url}
                        alt={foto.label}
                        className="w-full h-full object-cover"
                      />
                    </button>
                  ) : (
                    <div className="aspect-square rounded-xl border-2 border-dashed
                      border-gray-100 flex items-center justify-center">
                      <span className="text-gray-300 text-2xl">📷</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* COBRO */}
        {evolucion.cobro && (
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <h2 className="text-xs font-semibold text-gray-400 uppercase
              tracking-wide mb-3">Cobro de la atención</h2>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-semibold text-gray-800">
                  S/ {evolucion.cobro.monto?.toFixed(2) || '0.00'}
                </p>
                {evolucion.cobro.concepto && (
                  <p className="text-sm text-gray-500 mt-0.5">
                    {evolucion.cobro.concepto}
                  </p>
                )}
              </div>
              <span className="text-sm bg-primary-50 text-primary-700
                px-3 py-1.5 rounded-full font-medium">
                {medioPagoLabel[evolucion.cobro.medioPago] || evolucion.cobro.medioPago}
              </span>
            </div>
          </div>
        )}

        {/* Botón volver */}
        <div className="pb-6">
          <button
            onClick={() => router.push(
              `/evolucion?pacienteId=${evolucion.pacienteId}`
            )}
            className="w-full py-3 rounded-xl border border-gray-200 text-sm
              text-gray-600 hover:bg-gray-50 transition-colors font-medium"
          >
            ← Volver a evoluciones
          </button>
        </div>

      </div>

      {/* Modal foto ampliada */}
      {fotoAmpliada && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center
            justify-center p-4"
          onClick={() => setFotoAmpliada(null)}
        >
          <div className="relative max-w-lg w-full">
            <img
              src={fotoAmpliada}
              alt="Foto ampliada"
              className="w-full rounded-2xl"
            />
            <button
              onClick={() => setFotoAmpliada(null)}
              className="absolute top-3 right-3 w-8 h-8 bg-black/50
                text-white rounded-full flex items-center justify-center
                text-sm hover:bg-black/70 transition-colors"
            >✕</button>
          </div>
        </div>
      )}

    </div>
  )
}