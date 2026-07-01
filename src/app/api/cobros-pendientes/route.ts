import { NextRequest, NextResponse } from 'next/server'
import { getAdminDb } from '@/lib/firebase-admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const cobro = await req.json()
    const adminDb = await getAdminDb()
    const { Timestamp } = await import('firebase-admin/firestore')

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