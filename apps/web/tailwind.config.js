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
        navy: {
          950: '#070D18',
          900: '#0C1726',
          800: '#102A43',
          700: '#1A365D',
          600: '#274C77'
        },
        slate: {
          850: '#162232',
          750: '#243447',
          650: '#334E68',
          550: '#486581'
        },
        fintech: {
          green: '#10B981',
          greenLight: '#D1FAE5',
          greenDark: '#065F46',
          red: '#EF4444',
          redLight: '#FEE2E2',
          redDark: '#991B1B',
          amber: '#F59E0B',
          blue: '#3B82F6'
        }
      }
    },
  },
  plugins: [],
}
