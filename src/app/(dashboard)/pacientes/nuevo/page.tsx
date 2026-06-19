'use client'

import { useState } from 'react'
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'

export default function NuevoPacientePage() {
  const router = useRouter()
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    nombre: '',
    apellido: '',
    dni: '',
    edad: '',
    telefono: '',
    ocupacion: '',
    calzadoHabitual: '',
    motivoConsulta: '',
    // Antecedentes
    diabetes: false,
    hipertension: false,
    problemasCirculatorios: false,
    alergias: '',
    otros: '',
  })

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) {
    const target = e.target as HTMLInputElement
    const value = target.type === 'checkbox' ? target.checked : target.value
    setForm(prev => ({ ...prev, [target.name]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!form.nombre || !form.apellido || !form.dni) {
      setError('Nombre, apellido y DNI son obligatorios')
      return
    }

    setLoading(true)
    try {
      const docRef = await addDoc(collection(db, 'pacientes'), {
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
        fechaRegistro: serverTimestamp(),
        creadoPor: user?.uid,
      })
      router.push(`/pacientes/${docRef.id}`)
    } catch {
      setError('Error al guardar. Intenta nuevamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">

      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => router.back()}
          className="text-gray-400 hover:text-gray-600 transition-colors text-lg"
        >
          ←
        </button>
        <div>
          <h1 className="text-xl font-semibold text-gray-800">Nuevo paciente</h1>
          <p className="text-sm text-gray-500">Complete los datos del paciente</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">

        {/* DATOS PERSONALES */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-primary-50 text-primary-600
              flex items-center justify-center text-xs font-bold">1</span>
            Datos personales
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Nombre <span className="text-red-400">*</span>
              </label>
              <input
                name="nombre"
                value={form.nombre}
                onChange={handleChange}
                placeholder="Ej: María"
                className="input-field"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Apellido <span className="text-red-400">*</span>
              </label>
              <input
                name="apellido"
                value={form.apellido}
                onChange={handleChange}
                placeholder="Ej: García"
                className="input-field"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                DNI <span className="text-red-400">*</span>
              </label>
              <input
                name="dni"
                value={form.dni}
                onChange={handleChange}
                placeholder="Ej: 12345678"
                maxLength={8}
                className="input-field"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Edad
              </label>
              <input
                name="edad"
                type="number"
                value={form.edad}
                onChange={handleChange}
                placeholder="Ej: 35"
                min={1}
                max={120}
                className="input-field"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Teléfono
              </label>
              <input
                name="telefono"
                value={form.telefono}
                onChange={handleChange}
                placeholder="Ej: 987654321"
                className="input-field"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Ocupación
              </label>
              <input
                name="ocupacion"
                value={form.ocupacion}
                onChange={handleChange}
                placeholder="Ej: Profesora"
                className="input-field"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Calzado habitual
              </label>
              <select
                name="calzadoHabitual"
                value={form.calzadoHabitual}
                onChange={handleChange}
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
          <h2 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-primary-50 text-primary-600
              flex items-center justify-center text-xs font-bold">2</span>
            Antecedentes patológicos
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
            {[
              { name: 'diabetes', label: 'Diabetes', color: 'red' },
              { name: 'hipertension', label: 'Hipertensión', color: 'orange' },
              { name: 'problemasCirculatorios', label: 'Prob. circulatorios', color: 'yellow' },
            ].map(item => (
              <label
                key={item.name}
                className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer
                  transition-all ${
                    form[item.name as keyof typeof form]
                      ? 'border-primary-400 bg-primary-50'
                      : 'border-gray-100 hover:border-gray-200'
                  }`}
              >
                <input
                  type="checkbox"
                  name={item.name}
                  checked={form[item.name as keyof typeof form] as boolean}
                  onChange={handleChange}
                  className="w-4 h-4 accent-primary-600"
                />
                <span className="text-sm text-gray-700">{item.label}</span>
              </label>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Alergias
              </label>
              <input
                name="alergias"
                value={form.alergias}
                onChange={handleChange}
                placeholder="Ej: Penicilina, yodo..."
                className="input-field"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Otros antecedentes
              </label>
              <input
                name="otros"
                value={form.otros}
                onChange={handleChange}
                placeholder="Ej: Artritis, osteoporosis..."
                className="input-field"
              />
            </div>
          </div>
        </div>

        {/* MOTIVO DE CONSULTA */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-primary-50 text-primary-600
              flex items-center justify-center text-xs font-bold">3</span>
            Motivo de consulta
          </h2>
          <textarea
            name="motivoConsulta"
            value={form.motivoConsulta}
            onChange={handleChange}
            placeholder="Describa el motivo de la primera consulta..."
            rows={3}
            className="input-field resize-none"
          />
        </div>

        {error && (
          <p className="text-sm text-red-500 text-center bg-red-50
            rounded-lg py-2 px-4">{error}</p>
        )}

        {/* Botones */}
        <div className="flex gap-3 pb-6">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex-1 py-3 rounded-xl border border-gray-200 text-sm
              text-gray-600 hover:bg-gray-50 transition-colors font-medium"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 py-3 rounded-xl bg-primary-600 hover:bg-primary-700
              disabled:bg-primary-300 text-white text-sm font-medium
              transition-colors"
          >
            {loading ? 'Guardando...' : 'Guardar paciente'}
          </button>
        </div>

      </form>
    </div>
  )
}