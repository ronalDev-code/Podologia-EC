import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const PROJECT_ID = process.env.FIREBASE_ADMIN_PROJECT_ID!
const CLIENT_EMAIL = process.env.FIREBASE_ADMIN_CLIENT_EMAIL!
const PRIVATE_KEY = process.env.FIREBASE_ADMIN_PRIVATE_KEY!
  ?.replace(/\\n/g, '\n')

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
    Buffer.from(JSON.stringify(obj)).toString('base64url')
  const headerB64 = encode(header)
  const payloadB64 = encode(payload)
  const signingInput = `${headerB64}.${payloadB64}`
  const { createSign } = await import('crypto')
  const sign = createSign('RSA-SHA256')
  sign.update(signingInput)
  const signature = sign.sign(PRIVATE_KEY).toString('base64url')
  const jwt = `${signingInput}.${signature}`
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
    throw new Error('No se pudo obtener access token')
  }
  return tokenData.access_token
}

export async function POST(req: NextRequest) {
  try {
    const cobro = await req.json()
    const token = await getAccessToken()

    const fields: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(cobro)) {
      if (typeof value === 'string') {
        fields[key] = { stringValue: value }
      } else if (typeof value === 'number') {
        fields[key] = { doubleValue: value }
      } else if (typeof value === 'boolean') {
        fields[key] = { booleanValue: value }
      } else {
        fields[key] = { stringValue: String(value) }
      }
    }
    fields.migrado = { booleanValue: false }
    fields.fechaCreacion = {
      timestampValue: new Date().toISOString()
    }

    const res = await fetch(
      `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/cobros_pendientes`,
      {
        method: 'POST',
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

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Error en cobros-pendientes:', error)
    return NextResponse.json(
      { error: 'Error al guardar cobro pendiente' },
      { status: 500 }
    )
  }
}