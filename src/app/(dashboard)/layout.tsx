'use client'

import { useAuth } from '@/lib/auth-context'
import Sidebar from '@/components/layout/Sidebar'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login')
    }
  }, [user, loading, router])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center
        justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-primary-600
            border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-500">Cargando...</p>
        </div>
      </div>
    )
  }

  if (!user) return null

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      {/*
        pt-14 en móvil: espacio para la topbar fija
        md:pt-0: en desktop no hay topbar
      */}
      <main className="flex-1 min-w-0 overflow-auto
        pt-14 md:pt-0">
        {children}
      </main>
    </div>
  )
}