/** @type {import('tailwindcss').Config} */
// Palette and type are described in docs/VISUALS.md: ink black, paper white and screentone grays,
// Signal Orange for whatever is live, blood red for danger. The gray scale is neutral (screentone),
// and the rounded scale is clamped to hard edges: only cards (physical objects) get a real radius.
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: '#0B0B0D',
        paper: { DEFAULT: '#FAFAF7', shade: '#E6E6E1' },
        blood: { DEFAULT: '#D7192B', deep: '#8F0C18' },
        ember: { DEFAULT: '#E85D00', hot: '#FF7A1A', deep: '#A84300' },
        // Text on ink, and secondary text.
        bone: '#EFEFEA',
        mist: '#A3A3A8',
        // Old names, kept so nothing renders unstyled.
        'card-red': '#D7192B',
        'card-black': '#141416',
        gray: {
          50: '#F4F4F2',
          100: '#E6E6E3',
          200: '#CFCFCC',
          300: '#B2B2B0',
          400: '#8E8E8F',
          500: '#6B6B6E',
          600: '#4A4A4E',
          700: '#333336',
          800: '#202023',
          900: '#151517',
          950: '#0E0E10',
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
        // Hand-lettered comic caps for titles, heads and callouts; Barlow for reading.
        display: ['Bangers', '"H5 Seal"', 'Impact', 'sans-serif'],
        casino: ['Bangers', 'Impact', 'sans-serif'],
        sans: ['Barlow', 'ui-sans-serif', 'system-ui', '-apple-system', '"Segoe UI"', 'Roboto', '"H5 Seal"', 'sans-serif'],
        sfx: ['"H5 SFX"', 'Bangers', 'sans-serif'],
      },
      boxShadow: {
        'card': '0 2px 8px rgba(0, 0, 0, 0.3)',
        'card-hover': '0 4px 12px rgba(0, 0, 0, 0.4)',
        'glow': '0 0 20px rgba(232, 93, 0, 0.45)',
        // Hard comic offsets: no blur.
        'hard': '5px 5px 0 0 #000',
        'hard-sm': '3px 3px 0 0 #000',
        'hard-paper': '5px 5px 0 0 rgba(250,250,247,.9)',
      },
    },
  },
  plugins: [],
}
