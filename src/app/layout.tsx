import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { AuthProvider } from '@/lib/auth-context'

const inter = Inter({ subsets: ['latin'] })

const APP_NAME = 'Centro Podológico Erika Correa'
const APP_DESCRIPTION =
  'Sistema de Historia Clínica Podológica para el Centro ' +
  'Podológico Erika Correa. Gestión de pacientes, evoluciones, ' +
  'tratamientos y caja.'
const APP_URL = 'https://podologia-erika.vercel.app'

export const metadata: Metadata = {
  // ── BASE ──────────────────────────────────────────────
  title: {
    default: APP_NAME,
    template: `%s | ${APP_NAME}`,
  },
  description: APP_DESCRIPTION,
  applicationName: APP_NAME,
  authors: [{ name: 'RonalDev', url: 'https://ronaldev.com' }],
  generator: 'Next.js',
  keywords: [
    'podología',
    'historia clínica',
    'centro podológico',
    'Erika Correa',
    'Lima',
    'Perú',
    'pie diabético',
    'quiropodia',
    'tratamiento podológico',
    'sistema médico',
  ],
  creator: 'RonalDev',
  publisher: 'Centro Podológico Erika Correa',

  // ── ROBOTS ────────────────────────────────────────────
  // Sistema privado — no indexar en buscadores
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
    },
  },

  // ── PWA / MANIFEST ────────────────────────────────────
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Podología EC',
    startupImage: [
      {
        url: '/icons/icon-512x512.png',
        media: '(device-width: 320px) and (device-height: 568px)',
      },
    ],
  },

  // ── ICONOS ────────────────────────────────────────────
  icons: {
    icon: [
      {
        url: '/icons/favicon-16x16.png',
        sizes: '16x16',
        type: 'image/png',
      },
      {
        url: '/icons/favicon-32x32.png',
        sizes: '32x32',
        type: 'image/png',
      },
      {
        url: '/icons/icon-96x96.png',
        sizes: '96x96',
        type: 'image/png',
      },
      {
        url: '/icons/icon-192x192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        url: '/icons/icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
    apple: [
      {
        url: '/icons/apple-touch-icon.png',
        sizes: '180x180',
        type: 'image/png',
      },
      {
        url: '/icons/icon-152x152.png',
        sizes: '152x152',
        type: 'image/png',
      },
      {
        url: '/icons/icon-144x144.png',
        sizes: '144x144',
        type: 'image/png',
      },
    ],
    other: [
      {
        rel: 'mask-icon',
        url: '/icons/icon-512x512.png',
        color: '#0F6E56',
      },
    ],
  },

  // ── OPEN GRAPH (compartir en redes/WhatsApp) ──────────
  openGraph: {
    type: 'website',
    locale: 'es_PE',
    url: APP_URL,
    siteName: APP_NAME,
    title: APP_NAME,
    description: APP_DESCRIPTION,
    images: [
      {
        url: `${APP_URL}/icons/icon-512x512.png`,
        width: 512,
        height: 512,
        alt: 'Logo Centro Podológico Erika Correa',
      },
    ],
  },

  // ── TWITTER/X CARD ────────────────────────────────────
  twitter: {
    card: 'summary',
    title: APP_NAME,
    description: APP_DESCRIPTION,
    images: [`${APP_URL}/icons/icon-512x512.png`],
  },

  // ── VERIFICACIÓN (opcional, para Google Search Console) ─
  // verification: {
  //   google: 'TU_CODIGO_DE_VERIFICACION',
  // },

  // ── OTROS META ────────────────────────────────────────
  category: 'health',
  classification: 'Medical Software',
  referrer: 'no-referrer',
  formatDetection: {
    telephone: true,
    date: false,
    address: false,
    email: false,
    url: false,
  },
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#0F6E56' },
    { media: '(prefers-color-scheme: dark)', color: '#0F6E56' },
  ],
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es-PE">
      <head>
        {/* Preconnect para mejorar velocidad de carga */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          rel="preconnect"
          href="https://res.cloudinary.com"
        />
        {/* Microsoft tiles */}
        <meta name="msapplication-TileColor" content="#0F6E56" />
        <meta
          name="msapplication-TileImage"
          content="/icons/icon-144x144.png"
        />
        <meta name="msapplication-config" content="none" />
        {/* iOS Safari */}
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta
          name="apple-mobile-web-app-status-bar-style"
          content="black-translucent"
        />
        <meta
          name="apple-mobile-web-app-title"
          content="Podología EC"
        />
      </head>
      <body className={inter.className}>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  )
}