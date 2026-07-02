import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const PROJECT_ID = process.env.FIREBASE_ADMIN_PROJECT_ID!
const CLIENT_EMAIL = process.env.FIREBASE_ADMIN_CLIENT_EMAIL!
const PRIVATE_KEY = process.env.FIREBASE_ADMIN_PRIVATE_KEY!
  ?.replace(/\\n/g, '\n')

// Generar JWT para autenticar con Firebase REST API
async function getAccessToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const header = { alg: 'RS256', typ: 'JWT' }
  const payload = {
    iss: CLIENT_EMAIL,
    sub: CLIENT_EMAIL,
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
    scope: 'https://www.googleapis.com/auth/firebase https://www.googleapis.com/auth/cloud-platform',
  }

  const encode = (obj: object) =>
    Buffer.from(JSON.stringify(obj))
      .toString('base64url')

  const headerB64 = encode(header)
  const payloadB64 = encode(payload)
  const signingInput = `${headerB64}.${payloadB64}`

  // Importar crypto de Node.js para firmar con RS256
  const { createSign } = await import('crypto')
  const sign = createSign('RSA-SHA256')
  sign.update(signingInput)
  const signature = sign
    .sign(PRIVATE_KEY)
    .toString('base64url')

  const jwt = `${signingInput}.${signature}`

  // Intercambiar JWT por access token de Google
  const tokenRes = await fetch(
    'https://oauth2.googleapis.com/token',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: jwt,
      }),
    }
  )
  const tokenData = await tokenRes.json()
  if (!tokenData.access_token) {
    throw new Error('No se pudo obtener access token: ' +
      JSON.stringify(tokenData))
  }
  return tokenData.access_token
}

// Crear usuario en Firebase Auth via REST
async function crearUsuarioFirebase(
  email: string,
  password: string,
  displayName: string
): Promise<string> {
  const token = await getAccessToken()
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/projects/${PROJECT_ID}/accounts`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ email, password, displayName }),
    }
  )
  const data = await res.json()
  if (!res.ok) {
    const msg = data.error?.message || 'Error al crear usuario'
    throw new Error(msg)
  }
  return data.localId // uid del nuevo usuario
}

// Eliminar usuario en Firebase Auth via REST
async function eliminarUsuarioFirebase(uid: string): Promise<void> {
  const token = await getAccessToken()
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/projects/${PROJECT_ID}/accounts/${uid}`,
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    }
  )
  if (!res.ok) {
    const data = await res.json()
    throw new Error(data.error?.message || 'Error al eliminar usuario')
  }
}

// Guardar/eliminar en Firestore via REST
async function firestoreSet(
  collection: string,
  docId: string,
  data: Record<string, unknown>
): Promise<void> {
  const token = await getAccessToken()
  // Convertir data a formato Firestore REST
  const fields: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(data)) {
    if (typeof value === 'string') {
      fields[key] = { stringValue: value }
    } else if (typeof value === 'boolean') {
      fields[key] = { booleanValue: value }
    } else if (value === null) {
      fields[key] = { nullValue: null }
    } else {
      fields[key] = { stringValue: String(value) }
    }
  }

  const res = await fetch(
    `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${collection}/${docId}`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ fields }),
    }
  )
  if (!res.ok) {
    const err = await res.json()
    throw new Error(JSON.stringify(err))
  }
}

async function firestoreDelete(
  collection: string,
  docId: string
): Promise<void> {
  const token = await getAccessToken()
  const res = await fetch(
    `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${collection}/${docId}`,
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    }
  )
  if (!res.ok) {
    const err = await res.json()
    throw new Error(JSON.stringify(err))
  }
}

// ── HANDLERS ─────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const { nombre, email, password, creadoPor } = await req.json()

    if (!nombre || !email || !password) {
      return NextResponse.json(
        { error: 'Faltan campos requeridos' },
        { status: 400 }
      )
    }

    const uid = await crearUsuarioFirebase(email, password, nombre)

    await firestoreSet('usuarios', uid, {
      nombre,
      email,
      activo: 'true',
      creadoPor: creadoPor || '',
      fechaCreacion: new Date().toISOString(),
    })

    return NextResponse.json({
      uid,
      mensaje: 'Usuario creado correctamente'
    })

  } catch (error: unknown) {
    console.error('Error creando usuario:', error)
    const msg = error instanceof Error ? error.message : 'Error interno'
    const esEmailDuplicado =
      msg.includes('EMAIL_EXISTS') ||
      msg.includes('email-already-exists')
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

    await eliminarUsuarioFirebase(uid)
    await firestoreDelete('usuarios', uid)

    return NextResponse.json({
      mensaje: 'Usuario eliminado correctamente'
    })

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
    const token = await getAccessToken()
    const res = await fetch(
      `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/usuarios`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    )
    const data = await res.json()
    const usuarios = (data.documents || []).map((doc: {
      name: string
      fields: Record<string, { stringValue?: string; booleanValue?: boolean }>
    }) => {
      const id = doc.name.split('/').pop()
      const f = doc.fields || {}
      return {
        uid: id,
        nombre: f.nombre?.stringValue || '',
        email: f.email?.stringValue || '',
        activo: f.activo?.booleanValue ?? true,
        fechaCreacion: f.fechaCreacion?.stringValue || '',
      }
    })
    return NextResponse.json({ usuarios })
  } catch (error) {
    console.error('Error listando usuarios:', error)
    return NextResponse.json(
      { error: 'Error al obtener usuarios' },
      { status: 500 }
    )
  }
}