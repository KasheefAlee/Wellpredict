/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#e7f5f3',
          100: '#d4efea',
          200: '#b3e1d8',
          300: '#8ccfc3',
          400: '#62b8a8',
          500: '#3e9a94',
          600: '#2f887f',
          700: '#2a6f69',
          800: '#225853',
          900: '#1c4743',
        },
        brand: {
          // Background teal (from provided swatch)
          bg: '#0B6F6A',
        },
        accent: {
          50: '#ecf7f1',
          100: '#d7f0e2',
          200: '#bce4cd',
          300: '#9fd5b5',
          400: '#80c49b',
          500: '#66b485',
          600: '#4e9d70',
          700: '#3e7d59',
          800: '#325f46',
          900: '#294d3a',
        }
      },
    },
  },
  plugins: [],
}

