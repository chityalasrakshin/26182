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
        // Security Operations Dashboard Design Tokens (security-dashboard-ui-spec.md)
        brand: {
          DEFAULT: '#E5FF8F',
          tint1: '#EDFFB1',
          tint2: '#F2FFC7',
          tint3: '#F7FFDD',
          tint4: '#FCFFF4',
        },
        dark: {
          bg: '#0A0A0A',
          surface: '#161616',
          surfaceCard: '#1A1A1A',
          border: '#2A2A2A',
        },
        status: {
          success: '#7CFF6B',
          warning: '#E5D34F',
          critical: '#FF5C5C',
        },
        textPrimary: '#FFFFFF',
        textSecondary: '#9A9A9A',

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
