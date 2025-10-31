import type { Metadata } from 'next';

import './globals.css'
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { UserProfileProvider } from '@/contexts/UserProfileProvider';

export const metadata: Metadata = {
  title: 'Guardio',
  description: 'Your Personal Safety Companion App',
  viewport: 'width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Lato:ital,wght@0,100;0,300;0,400;0,700;0,900;1,100;1,300;1,400;1,700;1,900&display=swap" rel="stylesheet" />
      </head>
      <body suppressHydrationWarning={true} className="font-lato">
        <UserProfileProvider>
          <Navbar />
          <main className="relative overflow-hidden pt-20 sm:pt-24">
            {children}
          </main>
          <Footer />
        </UserProfileProvider>
      </body>
    </html>
  )
}
