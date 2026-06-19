import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import { Timestamp } from 'firebase-admin/firestore'

// Forzar runtime de Node.js (no Edge) para que
// firebase-admin funcione correctamente en Vercel
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const cobro = await req.json()
    await adminDb.collection('cobros_pendientes').add({
      ...cobro,
      fechaCreacion: Timestamp.now(),
      migrado: false,
    })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Error en cobros-pendientes:', error)
    return NextResponse.json(
      { error: 'Error al guardar cobro pendiente' },
      { status: 500 }
    )
  }
}