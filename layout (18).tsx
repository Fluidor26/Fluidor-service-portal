import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Fluidor Service Portal',
  description: 'Installaties, documentatie en serviceaanvragen van Fluidor Equipment B.V.',
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nl">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Archivo:wght@600;700;800&family=Source+Sans+3:wght@400;600;700&family=JetBrains+Mono:wght@400;500&display=swap"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
