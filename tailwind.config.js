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
      // Stage name easing in on the By stage screen (strong ease-out, short, no bounce)
      keyframes: {
        'stage-in': {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        }
      },
      animation: {
        'stage-in': 'stage-in 320ms cubic-bezier(0.23, 1, 0.32, 1) both'
      },
      screens: {
        'landscape-touch': { 'raw': '(orientation: landscape) and (max-height: 500px)' },
      }
    },
  },
  plugins: [],
}
