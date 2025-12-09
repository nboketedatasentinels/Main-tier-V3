/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          'deep-plum': '#27062e',
          'flame-orange': '#f4540c',
          'royal-purple': '#350e6f',
          'gold': '#eab130',
          'soft-gold': '#f9db59',
        },
      },
    },
  },
  plugins: [],
}
