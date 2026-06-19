'use client'

import { useState, useEffect, Suspense } from 'react'
import { collection, addDoc, serverTimestamp,
  doc, getDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { Paciente } from '@/types'

const TRATAMIENTOS_BASE = [
  { value: 'quiropodia', label: 'Quiropodia' },
  { value: 'fresado', label: 'Fresado' },
  { value: 'curacion', label: 'Curación' },
  { value: 'corteUnas', label: 'Corte de uñas' },
  { value: 'otro', label: 'Otro' },
]

const TRATAMIENTOS_SESIONES = [
  { value: 'placa_antimicotica', label: 'Placa antimicótica' },
  { value: 'ozono', label: 'Ozono' },
  { value: 'laser', label: 'Láser' },
]

const MEDIOS_PAGO = [
  { value: 'efectivo', label: '💵 Efectivo' },
  { value: 'tarjeta', label: '💳 Tarjeta' },
  { value: 'transferencia', label: '🏦 Transferencia' },
  { value: 'yape', label: '📱 Yape' },
  { value: 'plin', label: '📱 Plin' },
]

interface SesionForm {
  tipo: string
  sesiones: { numero: number; fecha: string; estado: string; observacion: string }[]
}

function NuevaEvolucionContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const pacienteId = searchParams.get('pacienteId') || ''
  const { user } = useAuth()

  const [paciente, setPaciente] = useState<Paciente | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [notaClinica, setNotaClinica] = useState('')
  const [medicamentos, setMedicamentos] = useState('')
  const [tratamientosSeleccionados, setTratamientosSeleccionados] = useState<string[]>([])
  const [sesionesEspeciales, setSesionesEspeciales] = useState<SesionForm[]>([])
  const [monto, setMonto] = useState('')
  const [medioPago, setMedioPago] = useState('efectivo')
  const [concepto, setConcepto] = useState('')

  // Fotos
  const [fotoAntes, setFotoAntes] = useState<File | null>(null)
  const [fotoIntermedio, setFotoIntermedio] = useState<File | null>(null)
  const [fotoDespues, setFotoDespues] = useState<File | null>(null)
  const [previews, setPreviews] = useState<{
    antes: string | null, intermedio: string | null, despues: string | null
  }>({ antes: null, intermedio: null, despues: null })

  useEffect(() => {
    if (!pacienteId) { router.push('/pacientes'); return }
    getDoc(doc(db, 'pacientes', pacienteId)).then(snap => {
      if (snap.exists()) setPaciente({ id: snap.id, ...snap.data() } as Paciente)
    })
  }, [pacienteId, router])

  function toggleTratamiento(valor: string) {
    setTratamientosSeleccionados(prev =>
      prev.includes(valor) ? prev.filter(t => t !== valor) : [...prev, valor]
    )
  }

  function agregarSesionEspecial(tipo: string) {
    const existe = sesionesEspeciales.find(s => s.tipo === tipo)
    if (existe) {
      setSesionesEspeciales(prev => prev.filter(s => s.tipo !== tipo))
      return
    }
    const sesiones = Array.from({ length: 10 }, (_, i) => ({
      numero: i + 1,
      fecha: '',
      estado: i === 0 ? 'realizado' : 'pendiente',
      observacion: '',
    }))
    setSesionesEspeciales(prev => [...prev, { tipo, sesiones }])
  }

  function actualizarSesion(
    tipo: string, numero: number,
    campo: string, valor: string
  ) {
    setSesionesEspeciales(prev => prev.map(s => {
      if (s.tipo !== tipo) return s
      return {
        ...s,
        sesiones: s.sesiones.map(ses =>
          ses.numero === numero ? { ...ses, [campo]: valor } : ses
        )
      }
    }))
  }

  function handleFoto(
    file: File | null,
    tipo: 'antes' | 'intermedio' | 'despues'
  ) {
    if (!file) return
    const setter = tipo === 'antes' ? setFotoAntes :
      tipo === 'intermedio' ? setFotoIntermedio : setFotoDespues
    setter(file)
    const url = URL.createObjectURL(file)
    setPreviews(prev => ({ ...prev, [tipo]: url }))
  }

  async function subirFoto(file: File, tipo: string): Promise<string> {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('pacienteId', pacienteId)
    formData.append('tipo', tipo)
    const res = await fetch('/api/fotos', { method: 'POST', body: formData })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Error subiendo foto')
    return data.url
  }

  async function registrarCobroEnCaja(datos: {
  pacienteNombre: string
  concepto: string
  monto: number
  medioPago: string
}) {
  try {
    const hoy = new Date()
    hoy.setHours(0, 0, 0, 0)
    const {
      Timestamp, where, orderBy, limit,
      query, getDocs, updateDoc, doc
    } = await import('firebase/firestore')

    const q = query(
      collection(db, 'cajas'),
      where('fecha', '>=', Timestamp.fromDate(hoy)),
      orderBy('fecha', 'desc'),
      limit(1)
    )
    const snap = await getDocs(q)

    if (snap.empty) {
      // NO hay caja hoy — guardar en cobros_pendientes
      // Se migrarán cuando se abra la caja
      await fetch('/api/cobros-pendientes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...datos,
          hora: new Date().toISOString(),
          fecha: new Date().toISOString(),
        }),
      })
      return
    }

    const cajaDoc = snap.docs[0]
    const cajaData = cajaDoc.data()

    if (cajaData.cerrada) {
      await updateDoc(doc(db, 'cajas', cajaDoc.id), {
        cerrada: false
      })
    }

    const cobrosActuales = cajaData.cobros || []
    const nuevoCobro = {
      id: Date.now().toString(),
      pacienteNombre: datos.pacienteNombre,
      concepto: datos.concepto,
      monto: datos.monto,
      medioPago: datos.medioPago,
      hora: new Date().toISOString(),
    }

    const cobrosActualizados = [...cobrosActuales, nuevoCobro]
    const totales = cobrosActualizados.reduce(
      (acc: Record<string, number>, c: Record<string, unknown>) => {
        acc.totalGeneral += c.monto as number
        if (c.medioPago === 'efectivo')
          acc.totalEfectivo += c.monto as number
        if (c.medioPago === 'tarjeta')
          acc.totalTarjeta += c.monto as number
        if (c.medioPago === 'transferencia')
          acc.totalTransferencia += c.monto as number
        if (c.medioPago === 'yape')
          acc.totalYape += c.monto as number
        if (c.medioPago === 'plin')
          acc.totalPlin += c.monto as number
        return acc
      }, {
        totalGeneral: 0, totalEfectivo: 0, totalTarjeta: 0,
        totalTransferencia: 0, totalYape: 0, totalPlin: 0
      }
    )

    await updateDoc(doc(db, 'cajas', cajaDoc.id), {
      cobros: cobrosActualizados, ...totales,
    })
  } catch (err) {
    console.error('Error registrando en caja:', err)
  }
}

  async function handleSubmit(e: React.FormEvent) {
  e.preventDefault()
  setError('')
  setLoading(true)

  try {
    // Subir fotos si hay
    let urlAntes = null, urlIntermedio = null, urlDespues = null
    if (fotoAntes) urlAntes = await subirFoto(fotoAntes, 'antes')
    if (fotoIntermedio) urlIntermedio = await subirFoto(fotoIntermedio, 'intermedio')
    if (fotoDespues) urlDespues = await subirFoto(fotoDespues, 'despues')

    // Guardar evolución
    await addDoc(collection(db, 'evoluciones'), {
      pacienteId,
      fecha: serverTimestamp(),
      notaClinica: notaClinica.trim(),
      medicamentos: medicamentos.trim(),
      tratamientosAplicados: tratamientosSeleccionados.map(t => ({
        tipo: t, descripcion: ''
      })),
      sesionesEspeciales: sesionesEspeciales.map(s => ({
        tipo: s.tipo,
        sesiones: s.sesiones,
      })),
      fotos: {
        antes: urlAntes,
        intermedio: urlIntermedio,
        despues: urlDespues,
      },
      cobro: {
        monto: parseFloat(monto) || 0,
        medioPago,
        concepto: concepto.trim(),
      },
      creadoPor: user?.uid,
    })

    // Registrar cobro automáticamente en caja abierta del día
    if (parseFloat(monto) > 0) {
      await registrarCobroEnCaja({
        pacienteNombre: `${paciente?.nombre} ${paciente?.apellido}`.trim(),
        concepto: concepto.trim() || tratamientosSeleccionados.join(', ') || 'Atención',
        monto: parseFloat(monto),
        medioPago,
      })
    }

    router.push(`/evolucion?pacienteId=${pacienteId}`)
  } catch (err) {
    setError('Error al guardar. Verifica tu conexión.')
    console.error(err)
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
        >←</button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-semibold text-gray-800">Nueva evolución</h1>
          {paciente && (
            <p className="text-sm text-gray-500">
              {paciente.nombre} {paciente.apellido}
            </p>
          )}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">

        {/* NOTA CLÍNICA */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-primary-50 text-primary-600
              flex items-center justify-center text-xs font-bold">1</span>
            Nota clínica y medicamentos
          </h2>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Nota de evolución
              </label>
              <textarea
                value={notaClinica}
                onChange={e => setNotaClinica(e.target.value)}
                placeholder="Descripción de la evolución del paciente..."
                rows={3}
                className="input-field resize-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Medicamentos aplicados
              </label>
              <input
                value={medicamentos}
                onChange={e => setMedicamentos(e.target.value)}
                placeholder="Ej: Antimicótico tópico, crema hidratante..."
                className="input-field"
              />
            </div>
          </div>
        </div>

        {/* TRATAMIENTOS BASE */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-primary-50 text-primary-600
              flex items-center justify-center text-xs font-bold">2</span>
            Tratamientos aplicados
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {TRATAMIENTOS_BASE.map(t => (
              <button
                key={t.value}
                type="button"
                onClick={() => toggleTratamiento(t.value)}
                className={`py-2.5 px-3 rounded-xl text-sm border-2 transition-all
                  text-left font-medium
                  ${tratamientosSeleccionados.includes(t.value)
                    ? 'border-primary-400 bg-primary-50 text-primary-700'
                    : 'border-gray-100 text-gray-600 hover:border-gray-200'
                  }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* SESIONES ESPECIALES */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-1 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-primary-50 text-primary-600
              flex items-center justify-center text-xs font-bold">3</span>
            Tratamientos con sesiones
          </h2>
          <p className="text-xs text-gray-400 mb-3 ml-8">
            Hasta 10 sesiones por tratamiento
          </p>

          <div className="grid grid-cols-3 gap-2 mb-4">
            {TRATAMIENTOS_SESIONES.map(t => (
              <button
                key={t.value}
                type="button"
                onClick={() => agregarSesionEspecial(t.value)}
                className={`py-2.5 px-2 rounded-xl text-xs border-2 transition-all
                  font-medium text-center
                  ${sesionesEspeciales.find(s => s.tipo === t.value)
                    ? 'border-primary-400 bg-primary-50 text-primary-700'
                    : 'border-gray-100 text-gray-600 hover:border-gray-200'
                  }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Tabla de sesiones */}
          {sesionesEspeciales.map(sesion => (
            <div key={sesion.tipo} className="mb-4">
              <p className="text-xs font-semibold text-primary-600 mb-2 uppercase
                tracking-wide">
                {TRATAMIENTOS_SESIONES.find(t => t.value === sesion.tipo)?.label}
              </p>
              <div className="space-y-2">
                {sesion.sesiones.map(ses => (
                  <div key={ses.numero}
                    className="grid grid-cols-12 gap-2 items-center">
                    <span className="col-span-1 text-xs text-gray-400 font-medium
                      text-center">
                      {ses.numero}
                    </span>
                    <input
                      type="date"
                      value={ses.fecha}
                      onChange={e => actualizarSesion(
                        sesion.tipo, ses.numero, 'fecha', e.target.value
                      )}
                      className="col-span-4 input-field text-xs py-1.5"
                    />
                    <select
                      value={ses.estado}
                      onChange={e => actualizarSesion(
                        sesion.tipo, ses.numero, 'estado', e.target.value
                      )}
                      className="col-span-3 input-field text-xs py-1.5"
                    >
                      <option value="pendiente">Pendiente</option>
                      <option value="realizado">Realizado</option>
                    </select>
                    <input
                      value={ses.observacion}
                      onChange={e => actualizarSesion(
                        sesion.tipo, ses.numero, 'observacion', e.target.value
                      )}
                      placeholder="Obs..."
                      className="col-span-4 input-field text-xs py-1.5"
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* FOTOS */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-primary-50 text-primary-600
              flex items-center justify-center text-xs font-bold">4</span>
            Fotografías del tratamiento
          </h2>
          <div className="grid grid-cols-3 gap-3">
            {([
              { key: 'antes', label: 'Antes', file: fotoAntes,
                preview: previews.antes },
              { key: 'intermedio', label: 'Durante', file: fotoIntermedio,
                preview: previews.intermedio },
              { key: 'despues', label: 'Después', file: fotoDespues,
                preview: previews.despues },
            ] as const).map(foto => (
              <div key={foto.key}>
                <p className="text-xs text-gray-500 mb-1 text-center">
                  {foto.label}
                </p>
                <label className="block cursor-pointer">
                  <div className={`aspect-square rounded-xl border-2 border-dashed
                    flex items-center justify-center overflow-hidden
                    transition-colors
                    ${foto.preview
                      ? 'border-primary-300'
                      : 'border-gray-200 hover:border-primary-300'
                    }`}>
                    {foto.preview ? (
                      <img
                        src={foto.preview}
                        alt={foto.label}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="text-center p-2">
                        <p className="text-2xl">📷</p>
                        <p className="text-[10px] text-gray-400 mt-1">
                          Toca para subir
                        </p>
                      </div>
                    )}
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={e => handleFoto(
                    e.target.files?.[0] || null,
                    foto.key
                  )}
                />
                </label>
              </div>
            ))}
          </div>
        </div>

        {/* COBRO */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-primary-50 text-primary-600
              flex items-center justify-center text-xs font-bold">5</span>
            Cobro de la atención
          </h2>

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  Monto (S/)
                </label>
                <input
                  type="number"
                  value={monto}
                  onChange={e => setMonto(e.target.value)}
                  placeholder="0.00"
                  min="0"
                  step="0.50"
                  className="input-field"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  Concepto
                </label>
                <input
                  value={concepto}
                  onChange={e => setConcepto(e.target.value)}
                  placeholder="Ej: Quiropodia"
                  className="input-field"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-2">
                Medio de pago
              </label>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                {MEDIOS_PAGO.map(mp => (
                  <button
                    key={mp.value}
                    type="button"
                    onClick={() => setMedioPago(mp.value)}
                    className={`py-2 px-1 rounded-xl text-xs border-2 transition-all
                      font-medium text-center
                      ${medioPago === mp.value
                        ? 'border-primary-400 bg-primary-50 text-primary-700'
                        : 'border-gray-100 text-gray-600 hover:border-gray-200'
                      }`}
                  >
                    {mp.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
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
            {loading ? 'Guardando...' : 'Guardar evolución'}
          </button>
        </div>

      </form>
    </div>
  )
}

export default function NuevaEvolucionPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-2 border-primary-600 border-t-transparent
          rounded-full animate-spin" />
      </div>
    }>
      <NuevaEvolucionContent />
    </Suspense>
  )
}