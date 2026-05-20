import type { Metadata } from 'next';
import Link from 'next/link';
import { Providers } from './providers';
import './globals.css';

export const metadata: Metadata = {
  title: 'Play Store Competition Monitor',
  description: 'Track competitor Google Play listings over time',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-muted/30 text-foreground antialiased">
        <Providers>
          <div className="min-h-screen flex flex-col">
            <header className="border-b bg-background">
              <div className="container flex h-14 items-center justify-between">
                <Link href="/" className="font-semibold">
                  Play Store Competition Monitor
                </Link>
                <span className="text-xs text-muted-foreground">
                  Google Play listing tracker
                </span>
              </div>
            </header>
            <main className="flex-1">
              <div className="container py-8">{children}</div>
            </main>
          </div>
        </Providers>
      </body>
    </html>
  );
}
