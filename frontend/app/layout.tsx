import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'CryptoTrace — Forensic Operations Dashboard',
  description: 'Cybersecurity and blockchain intelligence workstation for tracing cryptocurrency fund flows and attributing suspect wallets to Virtual Asset Service Providers.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="scroll-smooth">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@300;400;500;600;700&family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-[#F4F6F8] text-[#0F172A] antialiased min-h-screen font-sans selection:bg-sky-500/20 selection:text-sky-700">
        {children}
      </body>
    </html>
  );
}
