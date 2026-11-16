/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'felt-dark': '#1a3a1a',
        'felt': '#2d5a2d',
        'felt-light': '#3d6a3d',
        'card-red': '#ff0000',
        'card-black': '#000000',
        'gold': '#ffd700',
        'gold-dark': '#ccac00',
      },
      fontFamily: {
        'casino': ['Georgia', 'serif'],
      },
      boxShadow: {
        'card': '0 2px 8px rgba(0, 0, 0, 0.3)',
        'card-hover': '0 4px 12px rgba(0, 0, 0, 0.4)',
        'glow': '0 0 20px rgba(255, 215, 0, 0.5)',
      },
      animation: {
        'deal': 'deal 0.5s ease-out',
        'flip': 'flip 0.6s ease-in-out',
        'pulse-glow': 'pulseGlow 2s ease-in-out infinite',
      },
      keyframes: {
        deal: {
          'from': {
            transform: 'translateY(-200px) rotate(-180deg) scale(0.5)',
            opacity: '0'
          },
          'to': {
            transform: 'translateY(0) rotate(0) scale(1)',
            opacity: '1'
          }
        },
        flip: {
          '0%': { transform: 'rotateY(0)' },
          '50%': { transform: 'rotateY(90deg)' },
          '100%': { transform: 'rotateY(0)' }
        },
        pulseGlow: {
          '0%, 100%': { boxShadow: '0 0 20px rgba(255, 215, 0, 0.5)' },
          '50%': { boxShadow: '0 0 30px rgba(255, 215, 0, 0.8)' }
        }
      }
    },
  },
  plugins: [],
}