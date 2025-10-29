import type { Metadata } from 'next';

import './globals.css'
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { UserProfileProvider } from '@/contexts/UserProfileProvider';

export const metadata: Metadata = {
  title: 'Guardio',
  description: 'Your Personal Safety Companion App',
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
          <main className="relative overflow-hidden pt-24">
            {children}
          </main>
          <Footer />
        </UserProfileProvider>
      </body>
    </html>
  )
}
