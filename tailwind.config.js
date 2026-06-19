/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50:  '#E1F5EE',
          100: '#C3EBD8',
          200: '#9FD9C0',
          300: '#5DCAA5',
          400: '#2DB88A',
          500: '#0F9E6E',
          600: '#0F6E56',
          700: '#0A5242',
          800: '#073D31',
          900: '#042920',
        },
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
}