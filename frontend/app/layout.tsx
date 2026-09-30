import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'SETU.so — Forensic Operations Dashboard',
  description: 'SETU Cybersecurity and blockchain intelligence workstation for tracing cryptocurrency fund flows and attributing suspect wallets to Virtual Asset Service Providers.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark scroll-smooth">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@300;400;500;600;700&family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-[#0A0A0A] text-[#FFFFFF] antialiased min-h-screen font-sans selection:bg-[#E5FF8F]/30 selection:text-[#E5FF8F]">
        {children}
      </body>
    </html>
  );
}
