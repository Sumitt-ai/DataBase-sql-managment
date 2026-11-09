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
        brand: {
          50: '#f0f7ff',
          100: '#e0effe',
          200: '#b9dffe',
          300: '#7cc4fd',
          400: '#36a5fa',
          500: '#0c87eb',
          600: '#0069c9',
          700: '#0154a3',
          800: '#064786',
          900: '#0b3c6f',
          950: '#07264a',
        },
        mysql: {
          blue: '#00758F',
          orange: '#F29111',
          dark: '#0f172a'
        }
      }
    },
  },
  plugins: [],
}

