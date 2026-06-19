'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  collection, query, orderBy, limit,
  startAfter, getDocs, DocumentSnapshot
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { Paciente } from '@/types'
import { useRouter } from 'next/navigation'

const PAGE_SIZE = 20

export default function SeleccionarPacientePage() {
  const router = useRouter()
  const [pacientes, setPacientes] = useState<Paciente[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMas, setLoadingMas] = useState(false)
  const [ultimoDoc, setUltimoDoc] = useState<DocumentSnapshot | null>(null)
  const [hayMas, setHayMas] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const [buscando, setBuscando] = useState(false)

  const cargar = useCallback(async () => {
    setLoading(true)
    try {
      const q = query(
        collection(db, 'pacientes'),
        orderBy('apellido'),
        limit(PAGE_SIZE)
      )
      const snap = await getDocs(q)
      setPacientes(snap.docs.map(d => ({
        id: d.id, ...d.data()
      })) as Paciente[])
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
        collection(db, 'pacientes'),
        orderBy('apellido'),
        startAfter(ultimoDoc),
        limit(PAGE_SIZE)
      )
      const snap = await getDocs(q)
      setPacientes(prev => [...prev, ...snap.docs.map(d => ({
        id: d.id, ...d.data()
      })) as Paciente[]])
      setUltimoDoc(snap.docs[snap.docs.length - 1] ?? null)
      setHayMas(snap.docs.length === PAGE_SIZE)
    } finally {
      setLoadingMas(false)
    }
  }

  async function buscar(texto: string) {
    setBusqueda(texto)
    if (texto.trim().length < 2) { cargar(); return }
    setBuscando(true)
    try {
      const snap = await getDocs(query(
        collection(db, 'pacientes'),
        orderBy('apellido'),
        limit(50)
      ))
      const todos = snap.docs.map(d => ({
        id: d.id, ...d.data()
      })) as Paciente[]
      const t = texto.trim().toLowerCase()
      setPacientes(todos.filter(p =>
        `${p.nombre} ${p.apellido}`.toLowerCase().includes(t) ||
        p.dni?.includes(t)
      ))
      setHayMas(false)
    } finally {
      setBuscando(false)
    }
  }

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">

      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => router.push('/pacientes')}
          className="text-gray-400 hover:text-gray-600
            transition-colors text-lg"
        >←</button>
        <div>
          <h1 className="text-xl font-semibold text-gray-800">
            Seleccionar paciente
          </h1>
          <p className="text-sm text-gray-500">
            ¿Para qué paciente es la evolución?
          </p>
        </div>
      </div>

      {/* Buscador */}
      <div className="relative mb-4">
        <span className="absolute left-3 top-1/2 -translate-y-1/2
          text-gray-400 text-sm">🔍</span>
        <input
          type="text"
          value={busqueda}
          onChange={e => buscar(e.target.value)}
          placeholder="Buscar por nombre o DNI..."
          autoFocus
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
              className="h-14 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : pacientes.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-3xl mb-2">👥</p>
          <p className="text-gray-500 text-sm">
            No se encontraron pacientes
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {pacientes.map(p => (
            <button
              key={p.id}
              onClick={() => router.push(
                `/evolucion/nueva?pacienteId=${p.id}`
              )}
              className="w-full flex items-center gap-3 bg-white
                border border-gray-100 rounded-xl px-4 py-3
                hover:border-primary-200 hover:shadow-sm
                transition-all text-left group"
            >
              <div className="w-10 h-10 rounded-full bg-primary-50
                flex items-center justify-center text-primary-600
                font-semibold text-sm flex-shrink-0">
                {p.nombre?.charAt(0)}{p.apellido?.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800">
                  {p.nombre} {p.apellido}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  DNI: {p.dni} · {p.edad} años
                </p>
              </div>
              <span className="text-gray-300
                group-hover:text-primary-400 transition-colors">
                →
              </span>
            </button>
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