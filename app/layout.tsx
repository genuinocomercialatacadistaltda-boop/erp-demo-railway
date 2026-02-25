
export const dynamic = "force-dynamic"

import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import Script from 'next/script'
import './globals.css'
import { ThemeProvider } from '@/components/theme-provider'
import { SessionProvider } from '@/components/session-provider'
import { Toaster } from '@/components/ui/toaster'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXTAUTH_URL || 'http://localhost:3000'),
  title: '[SUA EMPRESA] - A Essência do Espetinho Perfeito',
  description: 'Aplicativo profissional para pedidos de espetinhos. Atacado e varejo com sistema completo de gestão.',
  keywords: 'espetinhos, churrasco, carne, frango, queijo coalho, atacado, varejo, delivery',
  icons: {
    icon: '/favicon.png',
    shortcut: '/favicon.png',
    apple: '/apple-touch-icon.png',
  },
  openGraph: {
    title: '[SUA EMPRESA] - A Essência do Espetinho Perfeito',
    description: 'Aplicativo profissional para pedidos de espetinhos. Atacado e varejo com sistema completo de gestão.',
    url: '/',
    siteName: '[SUA EMPRESA]',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: '[SUA EMPRESA]',
      },
    ],
    locale: 'pt_BR',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: '[SUA EMPRESA] - A Essência do Espetinho Perfeito',
    description: 'Aplicativo profissional para pedidos de espetinhos. Atacado e varejo com sistema completo de gestão.',
    images: ['/og-image.png'],
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className={inter.className}>
        {/* Google tag (gtag.js) */}
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=AW-17786884127"
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'AW-17786884127');
          `}
        </Script>

        <SessionProvider>
          <ThemeProvider
            attribute="class"
            defaultTheme="light"
            enableSystem
            disableTransitionOnChange
          >
            {children}
            <Toaster />
          </ThemeProvider>
        </SessionProvider>
      </body>
    </html>
  )
}
