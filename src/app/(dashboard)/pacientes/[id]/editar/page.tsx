'use client'

import { useState, useEffect } from 'react'
import { doc, getDoc, updateDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useRouter, useParams } from 'next/navigation'
import { Paciente } from '@/types'

type FormState = {
  nombre: string
  apellido: string
  dni: string
  edad: string
  telefono: string
  ocupacion: string
  calzadoHabitual: string
  motivoConsulta: string
  diabetes: boolean
  hipertension: boolean
  problemasCirculatorios: boolean
  alergias: string
  otros: string
}

export default function EditarPacientePage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [loading, setLoading] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState<FormState>({
    nombre: '',
    apellido: '',
    dni: '',
    edad: '',
    telefono: '',
    ocupacion: '',
    calzadoHabitual: '',
    motivoConsulta: '',
    diabetes: false,
    hipertension: false,
    problemasCirculatorios: false,
    alergias: '',
    otros: '',
  })

  useEffect(() => {
    async function cargar() {
      try {
        const snap = await getDoc(doc(db, 'pacientes', id))
        if (snap.exists()) {
          const p = snap.data() as Paciente
          setForm({
            nombre: p.nombre || '',
            apellido: p.apellido || '',
            dni: p.dni || '',
            edad: p.edad ? String(p.edad) : '',
            telefono: p.telefono || '',
            ocupacion: p.ocupacion || '',
            calzadoHabitual: p.calzadoHabitual || '',
            motivoConsulta: p.motivoConsulta || '',
            diabetes: p.antecedentes?.diabetes || false,
            hipertension: p.antecedentes?.hipertension || false,
            problemasCirculatorios:
              p.antecedentes?.problemasCirculatorios || false,
            alergias: p.antecedentes?.alergias || '',
            otros: p.antecedentes?.otros || '',
          })
        } else {
          router.push('/pacientes')
        }
      } finally {
        setLoading(false)
      }
    }
    cargar()
  }, [id, router])

  function handleTextChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
  }

  function handleSelectChange(
    e: React.ChangeEvent<HTMLSelectElement>
  ) {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
  }

  function handleCheckboxChange(
    e: React.ChangeEvent<HTMLInputElement>
  ) {
    const { name, checked } = e.target
    setForm(prev => ({ ...prev, [name]: checked }))
  }

  async function guardar() {
    if (!form.nombre || !form.apellido || !form.dni) {
      setError('Nombre, apellido y DNI son obligatorios')
      return
    }
    setGuardando(true)
    setError('')
    try {
      await updateDoc(doc(db, 'pacientes', id), {
        nombre: form.nombre.trim(),
        apellido: form.apellido.trim(),
        dni: form.dni.trim(),
        edad: Number(form.edad),
        telefono: form.telefono.trim(),
        ocupacion: form.ocupacion.trim(),
        calzadoHabitual: form.calzadoHabitual.trim(),
        motivoConsulta: form.motivoConsulta.trim(),
        antecedentes: {
          diabetes: form.diabetes,
          hipertension: form.hipertension,
          problemasCirculatorios: form.problemasCirculatorios,
          alergias: form.alergias.trim(),
          otros: form.otros.trim(),
        },
      })
      router.push(`/pacientes/${id}`)
    } catch {
      setError('Error al guardar. Intenta nuevamente.')
    } finally {
      setGuardando(false)
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

      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => router.push(`/pacientes/${id}`)}
          className="text-gray-400 hover:text-gray-600
            transition-colors text-lg"
        >
          ←
        </button>
        <div>
          <h1 className="text-xl font-semibold text-gray-800">
            Editar paciente
          </h1>
          <p className="text-sm text-gray-500">
            Actualiza los datos del paciente
          </p>
        </div>
      </div>

      <div className="space-y-4">

        {/* DATOS PERSONALES */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">
            Datos personales
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium
                text-gray-600 mb-1">
                Nombre <span className="text-red-400">*</span>
              </label>
              <input
                name="nombre"
                value={form.nombre}
                onChange={handleTextChange}
                className="input-field"
              />
            </div>
            <div>
              <label className="block text-xs font-medium
                text-gray-600 mb-1">
                Apellido <span className="text-red-400">*</span>
              </label>
              <input
                name="apellido"
                value={form.apellido}
                onChange={handleTextChange}
                className="input-field"
              />
            </div>
            <div>
              <label className="block text-xs font-medium
                text-gray-600 mb-1">
                DNI <span className="text-red-400">*</span>
              </label>
              <input
                name="dni"
                value={form.dni}
                onChange={handleTextChange}
                maxLength={8}
                className="input-field"
              />
            </div>
            <div>
              <label className="block text-xs font-medium
                text-gray-600 mb-1">
                Edad
              </label>
              <input
                name="edad"
                type="number"
                value={form.edad}
                onChange={handleTextChange}
                min={1}
                max={120}
                className="input-field"
              />
            </div>
            <div>
              <label className="block text-xs font-medium
                text-gray-600 mb-1">
                Teléfono
              </label>
              <input
                name="telefono"
                value={form.telefono}
                onChange={handleTextChange}
                className="input-field"
              />
            </div>
            <div>
              <label className="block text-xs font-medium
                text-gray-600 mb-1">
                Ocupación
              </label>
              <input
                name="ocupacion"
                value={form.ocupacion}
                onChange={handleTextChange}
                className="input-field"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium
                text-gray-600 mb-1">
                Calzado habitual
              </label>
              <select
                name="calzadoHabitual"
                value={form.calzadoHabitual}
                onChange={handleSelectChange}
                className="input-field"
              >
                <option value="">Seleccionar...</option>
                <option value="zapato_cerrado">Zapato cerrado</option>
                <option value="tacon_alto">Tacón alto</option>
                <option value="tacon_bajo">Tacón bajo</option>
                <option value="zapatilla">Zapatilla / deportivo</option>
                <option value="sandalia">Sandalia</option>
                <option value="descalzo">Descalzo frecuente</option>
                <option value="otro">Otro</option>
              </select>
            </div>
          </div>
        </div>

        {/* ANTECEDENTES */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">
            Antecedentes patológicos
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
            <label
              className={`flex items-center gap-3 p-3 rounded-xl
                border-2 cursor-pointer transition-all
                ${form.diabetes
                  ? 'border-primary-400 bg-primary-50'
                  : 'border-gray-100 hover:border-gray-200'
                }`}
            >
              <input
                type="checkbox"
                name="diabetes"
                checked={form.diabetes}
                onChange={handleCheckboxChange}
                className="w-4 h-4 accent-primary-600"
              />
              <span className="text-sm text-gray-700">Diabetes</span>
            </label>

            <label
              className={`flex items-center gap-3 p-3 rounded-xl
                border-2 cursor-pointer transition-all
                ${form.hipertension
                  ? 'border-primary-400 bg-primary-50'
                  : 'border-gray-100 hover:border-gray-200'
                }`}
            >
              <input
                type="checkbox"
                name="hipertension"
                checked={form.hipertension}
                onChange={handleCheckboxChange}
                className="w-4 h-4 accent-primary-600"
              />
              <span className="text-sm text-gray-700">Hipertensión</span>
            </label>

            <label
              className={`flex items-center gap-3 p-3 rounded-xl
                border-2 cursor-pointer transition-all
                ${form.problemasCirculatorios
                  ? 'border-primary-400 bg-primary-50'
                  : 'border-gray-100 hover:border-gray-200'
                }`}
            >
              <input
                type="checkbox"
                name="problemasCirculatorios"
                checked={form.problemasCirculatorios}
                onChange={handleCheckboxChange}
                className="w-4 h-4 accent-primary-600"
              />
              <span className="text-sm text-gray-700">
                Prob. circulatorios
              </span>
            </label>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium
                text-gray-600 mb-1">
                Alergias
              </label>
              <input
                name="alergias"
                value={form.alergias}
                onChange={handleTextChange}
                className="input-field"
              />
            </div>
            <div>
              <label className="block text-xs font-medium
                text-gray-600 mb-1">
                Otros antecedentes
              </label>
              <input
                name="otros"
                value={form.otros}
                onChange={handleTextChange}
                className="input-field"
              />
            </div>
          </div>
        </div>

        {/* MOTIVO */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">
            Motivo de consulta
          </h2>
          <textarea
            name="motivoConsulta"
            value={form.motivoConsulta}
            onChange={handleTextChange}
            rows={3}
            className="input-field resize-none"
          />
        </div>

        {error && (
          <p className="text-sm text-red-500 text-center bg-red-50
            rounded-lg py-2 px-4">
            {error}
          </p>
        )}

        {/* Botones */}
        <div className="flex gap-3 pb-6">
          <button
            onClick={() => router.push(`/pacientes/${id}`)}
            className="flex-1 py-3 rounded-xl border border-gray-200
              text-sm text-gray-600 hover:bg-gray-50
              transition-colors font-medium"
          >
            Cancelar
          </button>
          <button
            onClick={guardar}
            disabled={guardando}
            className="flex-1 py-3 rounded-xl bg-primary-600
              hover:bg-primary-700 disabled:bg-primary-300
              text-white text-sm font-medium transition-colors"
          >
            {guardando ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>

      </div>
    </div>
  )
}