/** @type {import('tailwindcss').Config} */
// Palette and type are described in docs/VISUALS.md. The gray scale is tinted toward the table's
// jade so every leftover gray-800 panel sits on the same surface, and the rounded scale is clamped
// to hard edges: only cards (physical objects) get a real corner radius.
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: '#0A1012',
        jade: {
          950: '#06110F',
          900: '#0B201D',
          800: '#113029',
          700: '#184139',
          600: '#21574C',
          500: '#2C6E60',
        },
        paper: { DEFAULT: '#F6F0E2', shade: '#E7DCC6' },
        cinnabar: { DEFAULT: '#C7352C', deep: '#8E1F1A' },
        ember: { DEFAULT: '#E85D00', hot: '#FF7A1A', deep: '#A84300' },
        brass: { DEFAULT: '#D6A54A', light: '#F2CF7E', deep: '#8C6420' },
        bone: '#ECE5D3',
        mist: '#8FA7A0',
        // Old names, kept so nothing renders unstyled.
        'felt-dark': '#0B201D',
        'felt': '#113029',
        'felt-light': '#184139',
        'card-red': '#C7352C',
        'card-black': '#1C1D24',
        'gold': '#D6A54A',
        'gold-dark': '#8C6420',
        gray: {
          50: '#F3F5F4',
          100: '#E4E9E7',
          200: '#C9D3D0',
          300: '#A9B7B3',
          400: '#84958F',
          500: '#62726D',
          600: '#3F4D49',
          700: '#2A3633',
          800: '#18221F',
          900: '#0E1614',
          950: '#080D0C',
        },
      },
      borderRadius: {
        sm: '1px',
        DEFAULT: '2px',
        md: '2px',
        lg: '2px',
        xl: '2px',
        '2xl': '2px',
      },
      fontFamily: {
        display: ['"Fraunces Variable"', 'Georgia', '"H5 Seal"', 'serif'],
        casino: ['"Fraunces Variable"', 'Georgia', 'serif'],
      },
      boxShadow: {
        'card': '0 2px 8px rgba(0, 0, 0, 0.3)',
        'card-hover': '0 4px 12px rgba(0, 0, 0, 0.4)',
        'glow': '0 0 20px rgba(232, 93, 0, 0.45)',
      },
    },
  },
  plugins: [],
}
