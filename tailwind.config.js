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
        },
        // Brew complete: 8-bit style, so every move is stepped rather than eased
        'pixel-spin': {
          '0%': { transform: 'perspective(240px) rotateY(0deg) scale(0.4)' },
          '30%': { transform: 'perspective(240px) rotateY(360deg) scale(1.2)' },
          '100%': { transform: 'perspective(240px) rotateY(720deg) scale(1)' }
        },
        'pixel-burst': {
          '0%': { opacity: '1', transform: 'translate(0, 0)' },
          '70%': { opacity: '1' },
          '100%': { opacity: '0', transform: 'translate(var(--dx), var(--dy))' }
        },
        'pixel-blink': {
          '0%, 24%, 48%': { opacity: '0' },
          '12%, 36%, 60%, 100%': { opacity: '1' }
        }
      },
      animation: {
        'stage-in': 'stage-in 320ms cubic-bezier(0.23, 1, 0.32, 1) both',
        'pixel-spin': 'pixel-spin 1300ms steps(8) both',
        'pixel-burst': 'pixel-burst 900ms steps(6) 300ms both',
        'pixel-blink': 'pixel-blink 900ms step-end 400ms both'
      }
    },
  },
  plugins: [],
}
