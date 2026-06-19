'use client'

import { useState, useEffect } from 'react'
import {
  doc, getDoc, collection, query,
  where, getDocs, deleteDoc, writeBatch
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { Paciente } from '@/types'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { generarPDFHistoria } from '@/lib/pdf-utils'

const calzadoLabel: Record<string, string> = {
  zapato_cerrado: 'Zapato cerrado',
  tacon_alto: 'Tacón alto',
  tacon_bajo: 'Tacón bajo',
  zapatilla: 'Zapatilla / deportivo',
  sandalia: 'Sandalia',
  descalzo: 'Descalzo frecuente',
  otro: 'Otro',
}

export default function DetallePacientePage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [paciente, setPaciente] = useState<Paciente | null>(null)
  const [loading, setLoading] = useState(true)
  const [eliminando, setEliminando] = useState(false)
  const [mostrarConfirmacion, setMostrarConfirmacion] = useState(false)
  const [textoConfirm, setTextoConfirm] = useState('')

  useEffect(() => {
    async function cargar() {
      try {
        const snap = await getDoc(doc(db, 'pacientes', id))
        if (snap.exists()) {
          setPaciente({ id: snap.id, ...snap.data() } as Paciente)
        } else {
          router.push('/pacientes')
        }
      } finally {
        setLoading(false)
      }
    }
    cargar()
  }, [id, router])

  async function eliminarPacienteCompleto() {
    if (!paciente) return
    setEliminando(true)
    try {
      const batch = writeBatch(db)

      // 1. Buscar y eliminar evoluciones
      const evolSnap = await getDocs(query(
        collection(db, 'evoluciones'),
        where('pacienteId', '==', id)
      ))
      evolSnap.docs.forEach(d => batch.delete(d.ref))

      // 2. Buscar y eliminar historias
      const histSnap = await getDocs(query(
        collection(db, 'historias'),
        where('pacienteId', '==', id)
      ))
      histSnap.docs.forEach(d => batch.delete(d.ref))

      // 3. Eliminar el paciente
      batch.delete(doc(db, 'pacientes', id))

      await batch.commit()
      router.push('/pacientes')
    } catch {
      setEliminando(false)
      alert('Error al eliminar. Intenta nuevamente.')
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

  if (!paciente) return null

  const tieneAntecedentes =
    paciente.antecedentes?.diabetes ||
    paciente.antecedentes?.hipertension ||
    paciente.antecedentes?.problemasCirculatorios ||
    paciente.antecedentes?.alergias ||
    paciente.antecedentes?.otros

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">

      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => router.push('/pacientes')}
          className="text-gray-400 hover:text-gray-600
            transition-colors text-lg"
        >←</button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-semibold text-gray-800 truncate">
            {paciente.nombre} {paciente.apellido}
          </h1>
          <p className="text-sm text-gray-500">DNI: {paciente.dni}</p>
        </div>
        <Link
          href={`/pacientes/${id}/editar`}
          className="text-sm text-primary-600 hover:text-primary-700
            font-medium transition-colors"
        >
          Editar
        </Link>
      </div>

      {/* Alertas antecedentes críticos */}
      {(paciente.antecedentes?.diabetes ||
        paciente.antecedentes?.hipertension ||
        paciente.antecedentes?.problemasCirculatorios) && (
        <div className="bg-red-50 border border-red-100
          rounded-xl p-4 mb-4">
          <p className="text-xs font-semibold text-red-600 mb-2">
            ⚠️ Antecedentes críticos
          </p>
          <div className="flex flex-wrap gap-2">
            {paciente.antecedentes?.diabetes && (
              <span className="text-xs bg-red-100 text-red-700
                px-2 py-1 rounded-full font-medium">
                Diabetes
              </span>
            )}
            {paciente.antecedentes?.hipertension && (
              <span className="text-xs bg-orange-100 text-orange-700
                px-2 py-1 rounded-full font-medium">
                Hipertensión
              </span>
            )}
            {paciente.antecedentes?.problemasCirculatorios && (
              <span className="text-xs bg-yellow-100 text-yellow-700
                px-2 py-1 rounded-full font-medium">
                Prob. circulatorios
              </span>
            )}
          </div>
        </div>
      )}

      {/* Datos personales */}
      <div className="bg-white rounded-2xl border border-gray-100
        p-5 mb-4">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">
          Datos personales
        </h2>
        <div className="grid grid-cols-2 gap-y-3 gap-x-4">
          {[
            { label: 'Nombre completo',
              value: `${paciente.nombre} ${paciente.apellido}` },
            { label: 'DNI', value: paciente.dni },
            { label: 'Edad',
              value: paciente.edad ? `${paciente.edad} años` : '—' },
            { label: 'Teléfono', value: paciente.telefono || '—' },
            { label: 'Ocupación',
              value: paciente.ocupacion || '—' },
            { label: 'Calzado habitual',
              value: calzadoLabel[paciente.calzadoHabitual] ||
                paciente.calzadoHabitual || '—' },
          ].map(item => (
            <div key={item.label}>
              <p className="text-xs text-gray-400">{item.label}</p>
              <p className="text-sm text-gray-800 font-medium mt-0.5">
                {item.value}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Antecedentes */}
      {tieneAntecedentes && (
        <div className="bg-white rounded-2xl border border-gray-100
          p-5 mb-4">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">
            Antecedentes patológicos
          </h2>
          <div className="space-y-2">
            {paciente.antecedentes?.alergias && (
              <div>
                <p className="text-xs text-gray-400">Alergias</p>
                <p className="text-sm text-gray-800 mt-0.5">
                  {paciente.antecedentes.alergias}
                </p>
              </div>
            )}
            {paciente.antecedentes?.otros && (
              <div>
                <p className="text-xs text-gray-400">
                  Otros antecedentes
                </p>
                <p className="text-sm text-gray-800 mt-0.5">
                  {paciente.antecedentes.otros}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Motivo de consulta */}
      {paciente.motivoConsulta && (
        <div className="bg-white rounded-2xl border border-gray-100
          p-5 mb-4">
          <h2 className="text-sm font-semibold text-gray-700 mb-2">
            Motivo de consulta
          </h2>
          <p className="text-sm text-gray-700 leading-relaxed">
            {paciente.motivoConsulta}
          </p>
        </div>
      )}

      {/* Acciones clínicas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
        <Link
          href={`/historia?pacienteId=${id}`}
          className="flex items-center justify-center gap-2
            bg-primary-600 hover:bg-primary-700 text-white
            text-sm font-medium py-3 rounded-xl transition-colors"
        >
          📋 Ver historia clínica
        </Link>
        <Link
          href={`/evolucion/nueva?pacienteId=${id}`}
          className="flex items-center justify-center gap-2
            bg-white hover:bg-gray-50 text-primary-600
            border border-primary-200 text-sm font-medium
            py-3 rounded-xl transition-colors"
        >
          ➕ Nueva evolución
        </Link>
      </div>

      {/* PDF */}
      <div className="mb-3">
        <button
          onClick={async () => {
            if (!paciente) return
            const { collection: col, query: q, where,
              getDocs, orderBy } = await import('firebase/firestore')
            const { db: firedb } = await import('@/lib/firebase')

            const hSnap = await getDocs(q(
              col(firedb, 'historias'),
              where('pacienteId', '==', id)
            ))
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const historia = hSnap.empty ? null : hSnap.docs[0].data() as any

            const eSnap = await getDocs(q(
              col(firedb, 'evoluciones'),
              where('pacienteId', '==', id),
              orderBy('fecha', 'desc')
            ))
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const evoluciones = eSnap.docs.map(d => d.data()) as any[]

            await generarPDFHistoria(paciente, historia, evoluciones)
          }}
          className="w-full flex items-center justify-center gap-2
            bg-gray-50 hover:bg-gray-100 border border-gray-200
            text-gray-700 text-sm font-medium py-3 rounded-xl
            transition-colors"
        >
          📄 Descargar historia clínica PDF
        </button>
      </div>

      {/* Eliminar paciente */}
      <div className="pb-6">
        <button
          onClick={() => setMostrarConfirmacion(true)}
          className="w-full flex items-center justify-center gap-2
            border-2 border-red-200 text-red-500
            hover:bg-red-50 text-sm font-medium py-3 rounded-xl
            transition-colors"
        >
          🗑️ Eliminar paciente
        </button>
      </div>

      {/* MODAL CONFIRMACIÓN ELIMINACIÓN */}
      {mostrarConfirmacion && (
        <div className="fixed inset-0 bg-black/60 z-50
          flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-red-100
                flex items-center justify-center flex-shrink-0">
                <span className="text-xl">⚠️</span>
              </div>
              <div>
                <h3 className="text-base font-semibold text-gray-800">
                  Eliminar paciente
                </h3>
                <p className="text-xs text-red-500 font-medium">
                  Esta acción no se puede deshacer
                </p>
              </div>
            </div>

            <div className="bg-red-50 rounded-xl p-3 mb-4">
              <p className="text-sm text-red-700 font-medium mb-1">
                Se eliminará permanentemente:
              </p>
              <ul className="text-xs text-red-600 space-y-1">
                <li>• Datos del paciente</li>
                <li>• Historia clínica completa</li>
                <li>• Todas las evoluciones y notas</li>
                <li>• Fotos del tratamiento</li>
                <li>• Sesiones de tratamiento programadas</li>
              </ul>
            </div>

            <p className="text-xs text-gray-500 mb-2">
              Para confirmar escribe{' '}
              <span className="font-bold text-gray-800">
                ELIMINAR
              </span>
            </p>
            <input
              value={textoConfirm}
              onChange={e => setTextoConfirm(e.target.value)}
              placeholder="Escribe ELIMINAR"
              className="input-field mb-4"
              autoFocus
            />

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setMostrarConfirmacion(false)
                  setTextoConfirm('')
                }}
                className="flex-1 py-2.5 rounded-xl border
                  border-gray-200 text-sm text-gray-600
                  hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={eliminarPacienteCompleto}
                disabled={textoConfirm !== 'ELIMINAR' || eliminando}
                className="flex-1 py-2.5 rounded-xl bg-red-500
                  hover:bg-red-600 disabled:bg-gray-200
                  disabled:text-gray-400 text-white text-sm
                  font-medium transition-colors"
              >
                {eliminando ? 'Eliminando...' : 'Sí, eliminar todo'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}