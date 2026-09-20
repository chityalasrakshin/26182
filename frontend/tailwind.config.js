/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Institutional Cryptocurrency Forensic Tokens (matching Chainalysis, Elliptic, & Scorechain)
        brand: {
          DEFAULT: '#0284C7', // Chainalysis Reactor & Scorechain Cyan-Blue
          hover: '#0369A1',
          tint1: '#38BDF8',
          tint2: '#7DD3FC',
          tint3: '#BAE6FD',
          tint4: '#E0F2FE',
          coral: '#F43F5E',
          amber: '#F59E0B',
          purple: '#6366F1',
          fuchsia: '#D946EF',
        },
        dark: {
          bg: '#F4F6F8',
          surface: '#FFFFFF',
          surfaceCard: '#FFFFFF',
          border: '#E2E8F0',
        },
        status: {
          success: '#10B981',
          warning: '#F59E0B',
          critical: '#EF4444',
          info: '#0284C7',
        },
        textPrimary: '#0F172A',
        textSecondary: '#64748B',

        // High-Visibility Institutional Theme Tokens (backed by CSS variables)
        forensic: {
          bg: "var(--forensic-bg)",
          canvas: "var(--forensic-canvas)",
          surface: "var(--forensic-surface)",
          surfaceRaised: "var(--forensic-surface-raised)",
          border: "var(--forensic-border)",
          borderMuted: "var(--forensic-border-muted)",
          text: "var(--forensic-text)",
          textMuted: "var(--forensic-text-muted)",
          textDim: "var(--forensic-text-dim)",
          accent: "var(--forensic-accent)",
          accentHover: "var(--forensic-accent-hover)",
          teal: "var(--forensic-teal)",
          amber: "var(--forensic-amber)",
          rose: "var(--forensic-rose)",
        },
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'IBM Plex Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
        'code-data': ['JetBrains Mono', 'monospace'],
      },
      fontSize: {
        '2xs': '0.65rem',
      },
    },
  },
  plugins: [],
};
