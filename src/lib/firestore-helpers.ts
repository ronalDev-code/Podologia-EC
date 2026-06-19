import {
  collection, query, orderBy, limit,
  startAfter, getDocs, where,
  DocumentSnapshot, QueryConstraint,
  WhereFilterOp, getDoc, doc
} from 'firebase/firestore'
import { db } from './firebase'
import { Paginacion } from '@/types'

const PAGE_SIZE = 20

// Cache simple en memoria para pacientes
const pacientesCache = new Map<string, {
  nombre: string, timestamp: number
}>()

const CACHE_TTL = 5 * 60 * 1000 // 5 minutos

export async function getNombrePaciente(
  pacienteId: string
): Promise<string> {
  const cached = pacientesCache.get(pacienteId)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.nombre
  }
  try {
    const snap = await getDoc(doc(db, 'pacientes', pacienteId))
    if (snap.exists()) {
      const p = snap.data()
      const nombre = `${p.nombre} ${p.apellido}`
      pacientesCache.set(pacienteId, {
        nombre, timestamp: Date.now()
      })
      return nombre
    }
  } catch {}
  return '—'
}

export async function getNombresPacientes(
  ids: string[]
): Promise<Map<string, string>> {
  const result = new Map<string, string>()
  const idsACargar = ids.filter(id => {
    const cached = pacientesCache.get(id)
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      result.set(id, cached.nombre)
      return false
    }
    return true
  })

  if (idsACargar.length > 0) {
    await Promise.all(
      idsACargar.map(async id => {
        const nombre = await getNombrePaciente(id)
        result.set(id, nombre)
      })
    )
  }

  return result
}

export async function getPaginado<T>(
  coleccion: string,
  ordenarPor: string = 'fechaCreacion',
  filtros: {
    campo: string
    operador: WhereFilterOp
    valor: unknown
  }[] = []
): Promise<Paginacion<T>> {
  const constraints: QueryConstraint[] = [
    ...filtros.map(f => where(f.campo, f.operador, f.valor)),
    orderBy(ordenarPor, 'desc'),
    limit(PAGE_SIZE),
  ]

  const q = query(collection(db, coleccion), ...constraints)
  const snapshot = await getDocs(q)

  return {
    data: snapshot.docs.map(d => ({
      id: d.id, ...d.data()
    })) as T[],
    ultimoDocumento: snapshot.docs[snapshot.docs.length - 1] ?? null,
    hayMas: snapshot.docs.length === PAGE_SIZE,
  }
}

export async function getSiguientePagina<T>(
  coleccion: string,
  ultimoDocumento: DocumentSnapshot,
  ordenarPor: string = 'fechaCreacion',
  filtros: {
    campo: string
    operador: WhereFilterOp
    valor: unknown
  }[] = []
): Promise<Paginacion<T>> {
  const constraints: QueryConstraint[] = [
    ...filtros.map(f => where(f.campo, f.operador, f.valor)),
    orderBy(ordenarPor, 'desc'),
    startAfter(ultimoDocumento),
    limit(PAGE_SIZE),
  ]

  const q = query(collection(db, coleccion), ...constraints)
  const snapshot = await getDocs(q)

  return {
    data: snapshot.docs.map(d => ({
      id: d.id, ...d.data()
    })) as T[],
    ultimoDocumento: snapshot.docs[snapshot.docs.length - 1] ?? null,
    hayMas: snapshot.docs.length === PAGE_SIZE,
  }
}