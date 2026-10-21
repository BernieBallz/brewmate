/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brew: {
          dark: '#0a0d14',
          card: '#121824',
          border: '#1f293d',
          amber: '#f59e0b',
          glow: '#fbbf24',
          emerald: '#10b981',
          copper: '#d97706',
          danger: '#ef4444',
          cyan: '#06b6d4',
          hud: '#05070a'
        }
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Roboto Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
        display: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      screens: {
        'landscape-touch': { 'raw': '(orientation: landscape) and (max-height: 500px)' },
      }
    },
  },
  plugins: [],
}
