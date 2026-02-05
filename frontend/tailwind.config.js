/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'selector',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f0f4ff',
          100: '#e0e9ff',
          200: '#c7d6fe',
          300: '#a4b8fc',
          400: '#8093f8',
          500: '#667eea',
          600: '#5468d4',
          700: '#4555ab',
          800: '#3c498b',
          900: '#35406f',
        },
        parent: {
          DEFAULT: '#dc143c',
          light: '#ff6b6b',
        },
        teacher: {
          DEFAULT: '#00b894',
          light: '#55efc4',
        },
        balanced: {
          DEFAULT: '#ff8c00',
          light: '#fdcb6e',
        }
      }
    },
  },
  plugins: [],
}
