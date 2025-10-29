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
      <body suppressHydrationWarning={true}>
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
