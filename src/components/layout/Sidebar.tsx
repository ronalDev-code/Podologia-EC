'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { useState, useEffect } from 'react'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'

const navItems = [
  {
    section: 'CLÍNICO',
    items: [
      { href: '/pacientes', label: 'Pacientes', icon: '👥' },
      { href: '/historia', label: 'Historias clínicas', icon: '📋' },
      { href: '/evolucion', label: 'Evoluciones', icon: '📈' },
      { href: '/agenda', label: 'Agenda', icon: '📅' },
      { href: '/tratamientos', label: 'Tratamientos', icon: '🩺' },
    ]
  },
  {
    section: 'ADMINISTRACIÓN',
    items: [
      { href: '/caja', label: 'Caja POS', icon: '💵' },
      { href: '/reportes', label: 'Reportes', icon: '📊' },
      { href: '/usuarios', label: 'Usuarios', icon: '👤' },
      { href: '/configuracion', label: 'Configuración', icon: '⚙️' },
    ]
  }
]

interface Config {
  nombre: string
  logoUrl: string | null
}

export default function Sidebar() {
  const pathname = usePathname()
  const { user, logout } = useAuth()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [config, setConfig] = useState<Config>({
    nombre: 'Centro Podológico',
    logoUrl: null,
  })

  useEffect(() => {
    getDoc(doc(db, 'config', 'consultorio')).then(snap => {
      if (snap.exists()) {
        const data = snap.data()
        setConfig({
          nombre: data.nombre || 'Centro Podológico',
          logoUrl: data.logoUrl || null,
        })
      }
    })
  }, [])

  // Cerrar sidebar al cambiar de ruta en móvil
  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  const NavContent = () => (
    <div className="flex flex-col h-full overflow-hidden">

      {/* Logo header — en móvil tiene padding extra a la izquierda
          para no solaparse con el botón hamburguesa externo */}
      <div className="px-4 py-5 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-white/15
            flex items-center justify-center flex-shrink-0
            overflow-hidden border border-white/20">
            {config.logoUrl ? (
              <img
                src={config.logoUrl}
                alt="Logo"
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-lg">🦶</span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-white text-sm font-semibold
              leading-tight truncate">
              Erika Correa
            </p>
            <p className="text-primary-300 text-xs leading-tight
              truncate">
              {config.nombre}
            </p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-4 overflow-y-auto space-y-4">
        {navItems.map(group => (
          <div key={group.section}>
            <p className="text-primary-400 text-[10px] font-semibold
              tracking-widest px-3 mb-1">
              {group.section}
            </p>
            {group.items.map(item => {
              const active = pathname === item.href ||
                pathname.startsWith(item.href + '/')
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2.5
                    rounded-lg text-sm transition-colors mb-0.5
                    ${active
                      ? 'bg-white/20 text-white font-medium'
                      : 'text-primary-200 hover:bg-white/10 hover:text-white'
                    }`}
                >
                  <span className="text-base w-5 text-center
                    flex-shrink-0">
                    {item.icon}
                  </span>
                  <span className="truncate">{item.label}</span>
                </Link>
              )
            })}
          </div>
        ))}
      </nav>

      {/* Usuario */}
      <div className="px-4 py-4 border-t border-white/10 flex-shrink-0">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-7 h-7 rounded-full bg-white/20
            flex items-center justify-center text-xs
            text-white font-semibold flex-shrink-0">
            {user?.email?.charAt(0).toUpperCase()}
          </div>
          <p className="text-white/80 text-xs truncate flex-1">
            {user?.email}
          </p>
        </div>
        <button
          onClick={logout}
          className="w-full text-left text-xs text-primary-300
            hover:text-white transition-colors px-1 py-1"
        >
          Cerrar sesión →
        </button>
      </div>
    </div>
  )

  return (
    <>
      {/* ── MÓVIL ── */}

      {/* Topbar móvil — barra superior fija con hamburguesa y logo */}
      <div className="fixed top-0 left-0 right-0 z-40 md:hidden
        bg-primary-600 h-14 flex items-center px-4 gap-3
        border-b border-white/10">
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="w-9 h-9 flex items-center justify-center
            text-white rounded-lg hover:bg-white/10
            transition-colors flex-shrink-0"
          aria-label="Menú"
        >
          {mobileOpen ? (
            <svg width="18" height="18" viewBox="0 0 24 24"
              fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24"
              fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 12h18M3 6h18M3 18h18"/>
            </svg>
          )}
        </button>

        {/* Logo en topbar móvil */}
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-full bg-white/15
            flex items-center justify-center flex-shrink-0
            overflow-hidden border border-white/20">
            {config.logoUrl ? (
              <img
                src={config.logoUrl}
                alt="Logo"
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-sm">🦶</span>
            )}
          </div>
          <div className="min-w-0">
            <p className="text-white text-sm font-semibold
              leading-tight truncate">
              Erika Correa
            </p>
          </div>
        </div>
      </div>

      {/* Overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Drawer lateral móvil */}
      <div className={`fixed inset-y-0 left-0 z-50 w-72
        bg-primary-600 transform transition-transform
        duration-300 ease-in-out md:hidden
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <NavContent />
      </div>

      {/* ── DESKTOP ── */}
      <div className="hidden md:flex md:flex-col w-56 bg-primary-600
        min-h-screen flex-shrink-0 sticky top-0 h-screen">
        <NavContent />
      </div>
    </>
  )
}