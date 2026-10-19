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
        dark: {
          bg: '#050709',       // Deepest obsidian black
          surface: '#0B0F14',  // Card background
          card: '#10151C',     // Elevated card container
          border: '#1B222D',   // Crisp subtle border
          muted: '#627284'     // Secondary label text
        },
        lime: {
          DEFAULT: '#CCFF00',  // Signature electric neon yellow-green
          400: '#D4FF33',
          300: '#E2FF66',
          900: '#2A3600'
        },
        navy: {
          950: '#050709',
          900: '#0B0F14',
          800: '#10151C',
          700: '#1B222D',
          600: '#263140'
        },
        slate: {
          900: '#0B0F14',
          850: '#10151C',
          750: '#1B222D',
          650: '#263140',
          550: '#627284'
        },
        fintech: {
          green: '#CCFF00',
          greenLight: '#E8FFA6',
          greenDark: '#2A3600',
          red: '#FF4D4D',
          redLight: '#FFE5E5',
          redDark: '#590000',
          amber: '#FFB800',
          blue: '#00D1FF'
        }
      }
    },
  },
  plugins: [],
}
