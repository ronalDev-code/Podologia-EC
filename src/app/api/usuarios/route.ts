import { NextRequest, NextResponse } from 'next/server'
import { adminAuth, adminDb } from '@/lib/firebase-admin'

export async function POST(req: NextRequest) {
  try {
    const { nombre, email, password, creadoPor } = await req.json()

    if (!nombre || !email || !password) {
      return NextResponse.json(
        { error: 'Faltan campos requeridos' },
        { status: 400 }
      )
    }

    const userRecord = await adminAuth.createUser({
      email,
      password,
      displayName: nombre,
    })

    await adminDb.collection('usuarios').doc(userRecord.uid).set({
      nombre,
      email,
      activo: true,
      creadoPor: creadoPor || null,
      fechaCreacion: new Date().toISOString(),
    })

    return NextResponse.json({
      uid: userRecord.uid,
      mensaje: 'Usuario creado correctamente'
    })

  } catch (error: unknown) {
    console.error('Error creando usuario:', error)
    const msg = error instanceof Error ? error.message : 'Error interno'
    const esEmailDuplicado = msg.includes('email-already-exists')
    return NextResponse.json(
      {
        error: esEmailDuplicado
          ? 'Ya existe una cuenta con ese correo'
          : msg
      },
      { status: 400 }
    )
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { uid } = await req.json()

    if (!uid) {
      return NextResponse.json(
        { error: 'UID requerido' },
        { status: 400 }
      )
    }

    // Eliminar de Firebase Auth
    await adminAuth.deleteUser(uid)

    // Eliminar de Firestore
    await adminDb.collection('usuarios').doc(uid).delete()

    return NextResponse.json({ mensaje: 'Usuario eliminado correctamente' })

  } catch (error: unknown) {
    console.error('Error eliminando usuario:', error)
    return NextResponse.json(
      { error: 'Error al eliminar usuario' },
      { status: 500 }
    )
  }
}

export async function GET() {
  try {
    const snap = await adminDb.collection('usuarios').get()
    const usuarios = snap.docs.map(d => ({
      uid: d.id, ...d.data()
    }))
    return NextResponse.json({ usuarios })
  } catch {
    return NextResponse.json(
      { error: 'Error al obtener usuarios' },
      { status: 500 }
    )
  }
}