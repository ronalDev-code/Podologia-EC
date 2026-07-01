import type { App } from 'firebase-admin/app'
import type { Auth } from 'firebase-admin/auth'
import type { Firestore } from 'firebase-admin/firestore'

let _adminApp: App | null = null
let _adminAuth: Auth | null = null
let _adminDb: Firestore | null = null

async function getAdminApp(): Promise<App> {
  if (_adminApp) return _adminApp

  const { initializeApp, getApps, cert } = await import('firebase-admin/app')

  if (getApps().length > 0) {
    _adminApp = getApps()[0]
    return _adminApp
  }

  _adminApp = initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY
        ?.replace(/\\n/g, '\n'),
    }),
  })

  return _adminApp
}

export async function getAdminAuth(): Promise<Auth> {
  if (_adminAuth) return _adminAuth
  const app = await getAdminApp()
  const { getAuth } = await import('firebase-admin/auth')
  _adminAuth = getAuth(app)
  return _adminAuth
}

export async function getAdminDb(): Promise<Firestore> {
  if (_adminDb) return _adminDb
  const app = await getAdminApp()
  const { getFirestore } = await import('firebase-admin/firestore')
  _adminDb = getFirestore(app)
  return _adminDb
}