/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        'lato': ['Lato', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
        'sans': ['Lato', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
      },
      colors: {
        // Base color palette with dark and light shades
        'blue-dark': '#001a4d',
        'blue-light': '#e6f2ff',
        'green-dark': '#004d1a',
        'green-light': '#e6ffe6',
        'red-dark': '#4d0000',
        'red-light': '#ffe6e6',
        'yellow-dark': '#4d3d00',
        'yellow-light': '#fffce6',
      },
    },
  },
  plugins: [],
}