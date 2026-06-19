'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  collection, query, orderBy, limit, getDocs,
  addDoc, updateDoc, doc, serverTimestamp,
  where, Timestamp
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { Caja, RegistroCobro } from '@/types'
import { useAuth } from '@/lib/auth-context'

const MEDIOS_PAGO = [
  { value: 'efectivo', label: '💵 Efectivo' },
  { value: 'tarjeta', label: '💳 Tarjeta' },
  { value: 'transferencia', label: '🏦 Transferencia' },
  { value: 'yape', label: '📱 Yape' },
  { value: 'plin', label: '📱 Plin' },
]

export default function CajaPage() {
  const { user } = useAuth()
  const [caja, setCaja] = useState<Caja | null>(null)
  const [loading, setLoading] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  const [montoInicial, setMontoInicial] = useState('')
  const [mostrarApertura, setMostrarApertura] = useState(false)
  const [mostrarCobro, setMostrarCobro] = useState(false)
  const [mostrarCierre, setMostrarCierre] = useState(false)

  const [cobroMonto, setCobroMonto] = useState('')
  const [cobroConcepto, setCobroConcepto] = useState('')
  const [cobroDetalle, setCobroDetalle] = useState('')
  const [cobroMedio, setCobroMedio] = useState('efectivo')

  // Para cuadre de caja
  const [efectivoContado, setEfectivoContado] = useState('')

  const cargarCajaHoy = useCallback(async () => {
    setLoading(true)
    try {
      const hoy = new Date()
      hoy.setHours(0, 0, 0, 0)
      const q = query(
        collection(db, 'cajas'),
        where('fecha', '>=', Timestamp.fromDate(hoy)),
        orderBy('fecha', 'desc'),
        limit(1)
      )
      const snap = await getDocs(q)
      if (!snap.empty) {
        setCaja({ id: snap.docs[0].id, ...snap.docs[0].data() } as Caja)
      } else {
        setCaja(null)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { cargarCajaHoy() }, [cargarCajaHoy])

  function calcularTotales(cobros: RegistroCobro[]) {
    return cobros.reduce((acc, c) => {
      acc.totalGeneral += c.monto
      if (c.medioPago === 'efectivo') acc.totalEfectivo += c.monto
      if (c.medioPago === 'tarjeta') acc.totalTarjeta += c.monto
      if (c.medioPago === 'transferencia') acc.totalTransferencia += c.monto
      if (c.medioPago === 'yape') acc.totalYape += c.monto
      if (c.medioPago === 'plin') acc.totalPlin += c.monto
      return acc
    }, {
      totalGeneral: 0, totalEfectivo: 0, totalTarjeta: 0,
      totalTransferencia: 0, totalYape: 0, totalPlin: 0
    })
  }

  // Efectivo esperado = fondo inicial + cobros en efectivo
  function efectivoEsperado(): number {
    if (!caja) return 0
    return (caja.montoInicial || 0) + (caja.totalEfectivo || 0)
  }

  function diferencia(): number {
    const contado = parseFloat(efectivoContado) || 0
    return contado - efectivoEsperado()
  }

  async function abrirCaja() {
  setGuardando(true)
  setError('')
  try {
    // Crear la caja
    const cajaRef = await addDoc(collection(db, 'cajas'), {
      fecha: serverTimestamp(),
      montoInicial: parseFloat(montoInicial) || 0,
      cobros: [],
      cerrada: false,
      totalEfectivo: 0,
      totalTarjeta: 0,
      totalTransferencia: 0,
      totalYape: 0,
      totalPlin: 0,
      totalGeneral: 0,
      creadoPor: user?.uid,
    })

    // Migrar cobros pendientes del día
    const hoy = new Date()
    hoy.setHours(0, 0, 0, 0)
    const fin = new Date()
    fin.setHours(23, 59, 59, 999)

    const { collection: col, query: q, where,
      Timestamp, getDocs, updateDoc,
      doc: firestoreDoc } = await import('firebase/firestore')

    const pendSnap = await getDocs(q(
      col(db, 'cobros_pendientes'),
      where('migrado', '==', false),
      where('fechaCreacion', '>=', Timestamp.fromDate(hoy))
    ))

    if (!pendSnap.empty) {
      const cobrosPendientes = pendSnap.docs.map(d => ({
        id: d.id,
        ...d.data(),
      }))

      // Agregar a la caja recién creada
      const cobrosParaCaja = cobrosPendientes.map(c => ({
        id: (c as Record<string, unknown>).id as string,
        pacienteNombre:
          (c as Record<string, unknown>).pacienteNombre as string || '—',
        concepto:
          (c as Record<string, unknown>).concepto as string || '—',
        monto: (c as Record<string, unknown>).monto as number || 0,
        medioPago:
          (c as Record<string, unknown>).medioPago as string || 'efectivo',
        hora: (c as Record<string, unknown>).hora as string,
      }))

      const totales = cobrosParaCaja.reduce(
        (acc: Record<string, number>, c) => {
          acc.totalGeneral += c.monto
          if (c.medioPago === 'efectivo') acc.totalEfectivo += c.monto
          if (c.medioPago === 'tarjeta') acc.totalTarjeta += c.monto
          if (c.medioPago === 'transferencia')
            acc.totalTransferencia += c.monto
          if (c.medioPago === 'yape') acc.totalYape += c.monto
          if (c.medioPago === 'plin') acc.totalPlin += c.monto
          return acc
        }, {
          totalGeneral: 0, totalEfectivo: 0, totalTarjeta: 0,
          totalTransferencia: 0, totalYape: 0, totalPlin: 0
        }
      )

      await updateDoc(firestoreDoc(db, 'cajas', cajaRef.id), {
        cobros: cobrosParaCaja, ...totales,
      })

      // Marcar pendientes como migrados
      await Promise.all(
        pendSnap.docs.map(d =>
          updateDoc(firestoreDoc(db, 'cobros_pendientes', d.id), {
            migrado: true
          })
        )
      )
    }

    await cargarCajaHoy()
    setMostrarApertura(false)
    setMontoInicial('')
  } catch {
    setError('Error al abrir caja')
  } finally {
    setGuardando(false)
  }
}

  async function reAbrirCaja() {
    if (!caja) return
    setGuardando(true)
    try {
      await updateDoc(doc(db, 'cajas', caja.id), {
        cerrada: false,
        fechaCierre: null,
        efectivoContado: null,
        diferencia: null,
      })
      setCaja(prev => prev ? { ...prev, cerrada: false } : null)
    } catch {
      setError('Error al reabrir caja')
    } finally {
      setGuardando(false)
    }
  }

  async function registrarOtroIngreso() {
    if (!cobroMonto || !cobroConcepto) {
      setError('Monto y concepto son obligatorios')
      return
    }
    if (!caja) return
    setGuardando(true)
    setError('')
    try {
      const nuevoCobro: RegistroCobro = {
        id: Date.now().toString(),
        pacienteNombre: cobroDetalle.trim(),
        concepto: cobroConcepto.trim(),
        monto: parseFloat(cobroMonto),
        medioPago: cobroMedio as RegistroCobro['medioPago'],
        hora: new Date(),
      }
      const cobrosActualizados = [...(caja.cobros || []), nuevoCobro]
      const totales = calcularTotales(cobrosActualizados)
      await updateDoc(doc(db, 'cajas', caja.id), {
        cobros: cobrosActualizados, ...totales,
      })
      setCaja(prev => prev ? {
        ...prev, cobros: cobrosActualizados, ...totales
      } : null)
      setMostrarCobro(false)
      setCobroMonto('')
      setCobroConcepto('')
      setCobroDetalle('')
      setCobroMedio('efectivo')
    } catch {
      setError('Error al registrar ingreso')
    } finally {
      setGuardando(false)
    }
  }

  async function cerrarCaja() {
    if (!caja) return
    setGuardando(true)
    try {
      const contado = parseFloat(efectivoContado) || 0
      const esperado = efectivoEsperado()
      const dif = contado - esperado

      await updateDoc(doc(db, 'cajas', caja.id), {
        cerrada: true,
        fechaCierre: serverTimestamp(),
        efectivoContado: contado,
        efectivoEsperado: esperado,
        diferencia: dif,
      })
      setCaja(prev => prev ? {
        ...prev, cerrada: true,
      } : null)
      setMostrarCierre(false)
      setEfectivoContado('')
    } catch {
      setError('Error al cerrar caja')
    } finally {
      setGuardando(false)
    }
  }

  function formatHora(hora: unknown): string {
    if (!hora) return '—'
    try {
      const ts = hora as { toDate?: () => Date }
      const date = ts.toDate ? ts.toDate() : new Date(hora as string)
      return date.toLocaleTimeString('es-PE', {
        hour: '2-digit', minute: '2-digit'
      })
    } catch { return '—' }
  }

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

  async function generarPDF() {
  if (!caja) return
  const { generarPDFCaja } = await import('@/lib/pdf-utils')
  await generarPDFCaja(caja as Parameters<typeof generarPDFCaja>[0])
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
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-800">
            Caja POS
          </h1>
          <p className="text-sm text-gray-500 capitalize">
            {new Date().toLocaleDateString('es-PE', {
              weekday: 'long', day: '2-digit',
              month: 'long', year: 'numeric'
            })}
          </p>
        </div>
        {caja && !caja.cerrada && (
          <span className="text-xs bg-green-100 text-green-700
            px-3 py-1.5 rounded-full font-medium">● Abierta</span>
        )}
        {caja?.cerrada && (
          <span className="text-xs bg-gray-100 text-gray-500
            px-3 py-1.5 rounded-full font-medium">Cerrada</span>
        )}
      </div>

      {/* SIN CAJA */}
      {!caja && (
        <div className="bg-white rounded-2xl border border-gray-100
          p-8 text-center">
          <p className="text-4xl mb-3">💵</p>
          <p className="text-gray-600 font-medium mb-1">
            No hay caja abierta hoy
          </p>
          <p className="text-sm text-gray-400 mb-6">
            Abre la caja con el fondo inicial del día.
            Los cobros de las atenciones se registrarán
            automáticamente.
          </p>
          <button
            onClick={() => setMostrarApertura(true)}
            className="bg-primary-600 hover:bg-primary-700
              text-white text-sm font-medium px-6 py-3
              rounded-xl transition-colors"
          >
            Abrir caja del día
          </button>
        </div>
      )}

      {/* CAJA */}
      {caja && (
        <div className="space-y-4">

          {/* Totales */}
          <div className="bg-primary-600 rounded-2xl p-5 text-white">
            <p className="text-primary-200 text-xs font-medium mb-1">
              Total ingresos del día
            </p>
            <p className="text-3xl font-bold mb-4">
              S/ {(caja.totalGeneral || 0).toFixed(2)}
            </p>
            <div className="grid grid-cols-3 gap-2 text-center">
              {[
                { label: 'Efectivo', val: caja.totalEfectivo },
                { label: 'Tarjeta', val: caja.totalTarjeta },
                { label: 'Transfer.', val: caja.totalTransferencia },
                { label: 'Yape', val: caja.totalYape },
                { label: 'Plin', val: caja.totalPlin },
                { label: 'Fondo ini.', val: caja.montoInicial },
              ].map(item => (
                <div key={item.label}
                  className="bg-white/10 rounded-xl py-2 px-1">
                  <p className="text-[10px] text-primary-200">
                    {item.label}
                  </p>
                  <p className="text-sm font-semibold">
                    S/ {(item.val || 0).toFixed(2)}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Efectivo esperado en caja */}
          <div className="bg-white rounded-2xl border border-gray-100 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-400">
                  Efectivo físico esperado en caja
                </p>
                <p className="text-lg font-semibold text-gray-800 mt-0.5">
                  S/ {efectivoEsperado().toFixed(2)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-400">
                  Fondo S/ {(caja.montoInicial || 0).toFixed(2)} +
                  efectivo S/ {(caja.totalEfectivo || 0).toFixed(2)}
                </p>
                <p className="text-xs text-gray-300 mt-0.5">
                  Digital: S/ {(
                    (caja.totalYape || 0) +
                    (caja.totalPlin || 0) +
                    (caja.totalTarjeta || 0) +
                    (caja.totalTransferencia || 0)
                  ).toFixed(2)}
                </p>
              </div>
            </div>
          </div>

          {/* Acciones */}
          {!caja.cerrada ? (
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setMostrarCobro(true)}
                className="flex items-center justify-center gap-2
                  bg-white hover:bg-gray-50 border border-gray-200
                  text-gray-700 text-sm font-medium py-3 rounded-xl
                  transition-colors"
              >
                ➕ Otro ingreso
              </button>
              <button
                onClick={() => setMostrarCierre(true)}
                className="flex items-center justify-center gap-2
                  bg-white hover:bg-gray-50 border border-gray-200
                  text-gray-700 text-sm font-medium py-3 rounded-xl
                  transition-colors"
              >
                🔒 Cerrar caja
              </button>
            </div>
          ) : (
            <div className="bg-amber-50 border border-amber-100
              rounded-xl p-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-amber-800">
                  Caja cerrada
                </p>
                <p className="text-xs text-amber-600 mt-0.5">
                  ¿Necesitas agregar un cobro? Puedes reabrir.
                </p>
              </div>
              <button
                onClick={reAbrirCaja}
                disabled={guardando}
                className="flex-shrink-0 text-xs bg-amber-100
                  hover:bg-amber-200 text-amber-800 font-medium
                  px-3 py-2 rounded-lg transition-colors
                  disabled:opacity-50"
              >
                Reabrir
              </button>
            </div>
          )}

          <button
            onClick={generarPDF}
            className="w-full flex items-center justify-center gap-2
              bg-white hover:bg-gray-50 border border-gray-200
              text-gray-700 text-sm font-medium py-3 rounded-xl
              transition-colors"
          >
            📄 Descargar PDF
          </button>

          {/* Lista cobros */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-700">
                Cobros del día
              </h2>
              <span className="text-xs bg-gray-100 text-gray-500
                px-2 py-1 rounded-full">
                {caja.cobros?.length || 0} atenciones
              </span>
            </div>
            {!caja.cobros?.length ? (
              <div className="text-center py-6">
                <p className="text-sm text-gray-400">Sin cobros aún</p>
                <p className="text-xs text-gray-300 mt-1">
                  Se registran automáticamente al guardar
                  una evolución con monto
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {[...(caja.cobros || [])].reverse().map((cobro, i) => (
                  <div key={cobro.id || i}
                    className="flex items-center justify-between
                      gap-3 py-2.5 border-b border-gray-50 last:border-0">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium text-gray-800 truncate">
                          {cobro.pacienteNombre || 'Sin nombre'}
                        </p>
                        <span className="text-[10px] bg-gray-100
                          text-gray-500 px-1.5 py-0.5 rounded-full
                          flex-shrink-0">
                          {cobro.medioPago}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {cobro.concepto} · {formatHora(cobro.hora)}
                      </p>
                    </div>
                    <p className="text-sm font-semibold text-gray-800
                      flex-shrink-0">
                      S/ {cobro.monto.toFixed(2)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      )}

      {/* MODAL APERTURA */}
      {mostrarApertura && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end
          sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6">
            <h3 className="text-base font-semibold text-gray-800 mb-1">
              Abrir caja del día
            </h3>
            <p className="text-xs text-gray-400 mb-4">
              Ingresa el efectivo físico que tienes en caja
              al inicio del día.
            </p>
            <div className="mb-4">
              <label className="block text-xs font-medium
                text-gray-500 mb-1">
                Fondo inicial en efectivo (S/)
              </label>
              <input
                type="number"
                value={montoInicial}
                onChange={e => setMontoInicial(e.target.value)}
                placeholder="0.00"
                min="0"
                step="0.50"
                className="input-field text-lg font-medium"
                autoFocus
              />
            </div>
            {error && (
              <p className="text-xs text-red-500 mb-3">{error}</p>
            )}
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setMostrarApertura(false)
                  setError('')
                }}
                className="flex-1 py-2.5 rounded-xl border
                  border-gray-200 text-sm text-gray-600
                  hover:bg-gray-50 transition-colors"
              >Cancelar</button>
              <button
                onClick={abrirCaja}
                disabled={guardando}
                className="flex-1 py-2.5 rounded-xl bg-primary-600
                  hover:bg-primary-700 disabled:bg-primary-300
                  text-white text-sm font-medium transition-colors"
              >
                {guardando ? 'Abriendo...' : 'Abrir caja'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL OTRO INGRESO */}
      {mostrarCobro && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end
          sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6">
            <h3 className="text-base font-semibold text-gray-800 mb-1">
              Otro ingreso
            </h3>
            <p className="text-xs text-gray-400 mb-4">
              Para ingresos que no son atenciones clínicas
              (venta de productos, etc.)
            </p>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium
                    text-gray-500 mb-1">Monto (S/) *</label>
                  <input
                    type="number"
                    value={cobroMonto}
                    onChange={e => setCobroMonto(e.target.value)}
                    placeholder="0.00"
                    min="0"
                    step="0.50"
                    className="input-field"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium
                    text-gray-500 mb-1">Concepto *</label>
                  <input
                    value={cobroConcepto}
                    onChange={e => setCobroConcepto(e.target.value)}
                    placeholder="Ej: Crema"
                    className="input-field"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium
                  text-gray-500 mb-1">Detalle</label>
                <input
                  value={cobroDetalle}
                  onChange={e => setCobroDetalle(e.target.value)}
                  placeholder="Descripción adicional"
                  className="input-field"
                />
              </div>
              <div>
                <label className="block text-xs font-medium
                  text-gray-500 mb-2">Medio de pago</label>
                <div className="grid grid-cols-3 gap-2">
                  {MEDIOS_PAGO.map(mp => (
                    <button key={mp.value} type="button"
                      onClick={() => setCobroMedio(mp.value)}
                      className={`py-2 rounded-xl text-xs border-2
                        transition-all font-medium
                        ${cobroMedio === mp.value
                          ? 'border-primary-400 bg-primary-50 text-primary-700'
                          : 'border-gray-100 text-gray-600'}`}>
                      {mp.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            {error && (
              <p className="text-xs text-red-500 mt-3">{error}</p>
            )}
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => {
                  setMostrarCobro(false)
                  setError('')
                }}
                className="flex-1 py-2.5 rounded-xl border
                  border-gray-200 text-sm text-gray-600
                  hover:bg-gray-50 transition-colors"
              >Cancelar</button>
              <button
                onClick={registrarOtroIngreso}
                disabled={guardando}
                className="flex-1 py-2.5 rounded-xl bg-primary-600
                  hover:bg-primary-700 disabled:bg-primary-300
                  text-white text-sm font-medium transition-colors"
              >
                {guardando ? 'Guardando...' : 'Registrar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CIERRE CON CUADRE */}
      {mostrarCierre && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end
          sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6">
            <h3 className="text-base font-semibold text-gray-800 mb-2">
              Cierre de caja
            </h3>

            {/* Resumen */}
            <div className="bg-gray-50 rounded-xl p-3 mb-4 space-y-1.5">
              <p className="text-xs font-semibold text-gray-500
                uppercase tracking-wide mb-2">Ingresos del día</p>
              {[
                { label: 'Efectivo cobrado', val: caja?.totalEfectivo },
                { label: 'Tarjeta', val: caja?.totalTarjeta },
                { label: 'Transferencia', val: caja?.totalTransferencia },
                { label: 'Yape', val: caja?.totalYape },
                { label: 'Plin', val: caja?.totalPlin },
              ].map(item => (
                <div key={item.label}
                  className="flex justify-between text-sm">
                  <span className="text-gray-500">{item.label}</span>
                  <span className="font-medium text-gray-800">
                    S/ {(item.val || 0).toFixed(2)}
                  </span>
                </div>
              ))}
              <div className="flex justify-between text-sm font-semibold
                pt-1.5 border-t border-gray-200">
                <span className="text-gray-700">Total ingresos</span>
                <span className="text-primary-600">
                  S/ {(caja?.totalGeneral || 0).toFixed(2)}
                </span>
              </div>
            </div>

            {/* Cuadre de efectivo */}
            <div className="bg-blue-50 rounded-xl p-3 mb-4">
              <p className="text-xs font-semibold text-blue-600
                uppercase tracking-wide mb-2">Cuadre de efectivo</p>
              <div className="flex justify-between text-sm mb-3">
                <span className="text-gray-500">
                  Efectivo esperado en caja
                </span>
                <span className="font-semibold text-gray-800">
                  S/ {efectivoEsperado().toFixed(2)}
                </span>
              </div>
              <div>
                <label className="block text-xs font-medium
                  text-gray-600 mb-1">
                  Efectivo contado físicamente (S/)
                </label>
                <input
                  type="number"
                  value={efectivoContado}
                  onChange={e => setEfectivoContado(e.target.value)}
                  placeholder="0.00"
                  min="0"
                  step="0.50"
                  className="input-field"
                  autoFocus
                />
              </div>
              {efectivoContado && (
                <div className={`mt-2 flex justify-between text-sm
                  font-semibold rounded-lg p-2
                  ${diferencia() >= 0
                    ? 'bg-green-100 text-green-700'
                    : 'bg-red-100 text-red-700'}`}>
                  <span>
                    {diferencia() >= 0 ? '✓ Sobrante' : '⚠ Faltante'}
                  </span>
                  <span>
                    S/ {Math.abs(diferencia()).toFixed(2)}
                  </span>
                </div>
              )}
            </div>

            <p className="text-xs text-gray-400 mb-4">
              Puedes reabrir la caja si necesitas corregir algo.
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => setMostrarCierre(false)}
                className="flex-1 py-2.5 rounded-xl border
                  border-gray-200 text-sm text-gray-600
                  hover:bg-gray-50 transition-colors"
              >Cancelar</button>
              <button
                onClick={cerrarCaja}
                disabled={guardando}
                className="flex-1 py-2.5 rounded-xl bg-primary-600
                  hover:bg-primary-700 disabled:bg-primary-300
                  text-white text-sm font-medium transition-colors"
              >
                {guardando ? 'Cerrando...' : 'Confirmar cierre'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}