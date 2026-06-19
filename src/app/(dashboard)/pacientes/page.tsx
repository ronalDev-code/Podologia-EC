'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  collection, query, orderBy, limit, startAfter,
  getDocs, DocumentSnapshot, where
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { Paciente } from '@/types'
import Link from 'next/link'

const PAGE_SIZE = 20

export default function PacientesPage() {
  const [pacientes, setPacientes] = useState<Paciente[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMas, setLoadingMas] = useState(false)
  const [ultimoDoc, setUltimoDoc] = useState<DocumentSnapshot | null>(null)
  const [hayMas, setHayMas] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const [buscando, setBuscando] = useState(false)

  const cargarPacientes = useCallback(async () => {
    setLoading(true)
    try {
      const q = query(
        collection(db, 'pacientes'),
        orderBy('apellido'),
        limit(PAGE_SIZE)
      )
      const snap = await getDocs(q)
      const data = snap.docs.map(d => ({
        id: d.id, ...d.data()
      })) as Paciente[]
      setPacientes(data)
      setUltimoDoc(snap.docs[snap.docs.length - 1] ?? null)
      setHayMas(snap.docs.length === PAGE_SIZE)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { cargarPacientes() }, [cargarPacientes])

  async function cargarMas() {
    if (!ultimoDoc || loadingMas) return
    setLoadingMas(true)
    try {
      const q = query(
        collection(db, 'pacientes'),
        orderBy('apellido'),
        startAfter(ultimoDoc),
        limit(PAGE_SIZE)
      )
      const snap = await getDocs(q)
      const data = snap.docs.map(d => ({
        id: d.id, ...d.data()
      })) as Paciente[]
      setPacientes(prev => [...prev, ...data])
      setUltimoDoc(snap.docs[snap.docs.length - 1] ?? null)
      setHayMas(snap.docs.length === PAGE_SIZE)
    } finally {
      setLoadingMas(false)
    }
  }

  async function buscarPacientes(texto: string) {
    setBusqueda(texto)
    if (texto.trim().length < 2) {
      cargarPacientes()
      return
    }
    setBuscando(true)
    try {
      const q = query(
        collection(db, 'pacientes'),
        orderBy('apellido'),
        limit(50)
      )
      const snap = await getDocs(q)
      const todos = snap.docs.map(d => ({
        id: d.id, ...d.data()
      })) as Paciente[]
      const textoBuscar = texto.trim().toLowerCase()
      const filtrados = todos.filter(p =>
        `${p.nombre} ${p.apellido}`.toLowerCase()
          .includes(textoBuscar) ||
        p.dni?.includes(textoBuscar)
      )
      setPacientes(filtrados)
      setHayMas(false)
    } finally {
      setBuscando(false)
    }
  }

  function antecedentesIconos(p: Paciente) {
    const items = []
    if (p.antecedentes?.diabetes)
      items.push({ label: 'DM', color: 'bg-red-100 text-red-700' })
    if (p.antecedentes?.hipertension)
      items.push({ label: 'HTA', color: 'bg-orange-100 text-orange-700' })
    if (p.antecedentes?.problemasCirculatorios)
      items.push({ label: 'CIRC', color: 'bg-yellow-100 text-yellow-700' })
    return items
  }

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">

      {/* Dashboard rápido */}
<div className="grid grid-cols-2 gap-3 mb-6">
  <Link
    href="/caja"
    className="bg-primary-600 rounded-xl p-4 text-white
      hover:bg-primary-700 transition-colors"
  >
    <p className="text-primary-200 text-xs mb-1">Caja del día</p>
    <p className="text-sm font-semibold">Ir a caja →</p>
  </Link>
  <Link
    href="/evolucion/seleccionar-paciente"
    className="bg-white border border-primary-200 rounded-xl
      p-4 text-primary-600 hover:bg-primary-50 transition-colors"
  >
    <p className="text-gray-400 text-xs mb-1">Atención rápida</p>
    <p className="text-sm font-semibold">Nueva evolución →</p>
  </Link>
</div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center
        justify-between gap-3 mb-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-800">
            Pacientes
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {pacientes.length} registros cargados
          </p>
        </div>
        <Link
          href="/pacientes/nuevo"
          className="inline-flex items-center gap-2 bg-primary-600
            hover:bg-primary-700 text-white text-sm font-medium
            px-4 py-2.5 rounded-lg transition-colors"
        >
          <span className="text-base">+</span>
          Nuevo paciente
        </Link>
      </div>

      {/* Buscador */}
      <div className="relative mb-4">
        <span className="absolute left-3 top-1/2 -translate-y-1/2
          text-gray-400 text-sm">🔍</span>
        <input
          type="text"
          value={busqueda}
          onChange={e => buscarPacientes(e.target.value)}
          placeholder="Buscar por nombre o DNI..."
          className="w-full pl-9 pr-4 py-2.5 rounded-lg border
            border-gray-200 text-sm focus:outline-none
            focus:ring-2 focus:ring-primary-500
            focus:border-transparent bg-white transition"
        />
        {buscando && (
          <span className="absolute right-3 top-1/2
            -translate-y-1/2 text-xs text-gray-400">
            Buscando...
          </span>
        )}
      </div>

      {/* Lista */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i}
              className="h-16 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : pacientes.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-4xl mb-3">👥</p>
          <p className="text-gray-500 text-sm">
            {busqueda
              ? 'No se encontraron pacientes'
              : 'Aún no hay pacientes registrados'}
          </p>
          {!busqueda && (
            <Link
              href="/pacientes/nuevo"
              className="inline-block mt-4 text-sm text-primary-600
                hover:text-primary-700 font-medium"
            >
              Registrar el primer paciente →
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {pacientes.map(paciente => (
            <Link
              key={paciente.id}
              href={`/pacientes/${paciente.id}`}
              className="flex items-center gap-3 bg-white border
                border-gray-100 rounded-xl px-4 py-3
                hover:border-primary-200 hover:shadow-sm
                transition-all group"
            >
              {/* Avatar */}
              <div className="w-10 h-10 rounded-full bg-primary-50
                flex items-center justify-center text-primary-600
                font-semibold text-sm flex-shrink-0">
                {paciente.nombre?.charAt(0)}
                {paciente.apellido?.charAt(0)}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-medium text-gray-800">
                    {paciente.nombre} {paciente.apellido}
                  </p>
                  {antecedentesIconos(paciente).map(a => (
                    <span key={a.label}
                      className={`text-[10px] font-semibold
                        px-1.5 py-0.5 rounded ${a.color}`}>
                      {a.label}
                    </span>
                  ))}
                </div>
                <p className="text-xs text-gray-400 mt-0.5">
                  DNI: {paciente.dni} · {paciente.edad} años
                  {paciente.telefono && ` · ${paciente.telefono}`}
                </p>
              </div>

              {/* Flecha */}
              <span className="text-gray-300
                group-hover:text-primary-400 transition-colors
                text-sm flex-shrink-0">
                →
              </span>
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
              {loadingMas
                ? 'Cargando...'
                : 'Cargar más pacientes'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}