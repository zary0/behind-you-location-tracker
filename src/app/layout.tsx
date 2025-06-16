import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import MuiThemeProvider from '@/components/MuiThemeProvider'

const inter = Inter({ 
  subsets: ['latin'],
  display: 'swap',
  preload: true
})

export const metadata: Metadata = {
  title: 'ReverseGeo - その一枚から、世界を探し出すAI',
  description: 'AI-powered reverse geolocation service that identifies locations from single images',
  keywords: 'AI, geolocation, image recognition, location detection, reverse geo, photo location',
  authors: [{ name: 'ReverseGeo' }],
  creator: 'ReverseGeo',
  publisher: 'ReverseGeo',
  viewport: 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no',
  themeColor: '#000000',
  robots: 'index, follow',
  openGraph: {
    title: 'ReverseGeo - その一枚から、世界を探し出すAI',
    description: 'AI-powered reverse geolocation service that identifies locations from single images',
    type: 'website',
    siteName: 'ReverseGeo',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ReverseGeo - その一枚から、世界を探し出すAI',
    description: 'AI-powered reverse geolocation service that identifies locations from single images',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <MuiThemeProvider>
          {children}
        </MuiThemeProvider>
      </body>
    </html>
  )
}