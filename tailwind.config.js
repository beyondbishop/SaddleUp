/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        saddle: {
          brown: '#3a2416',
          tan: '#c9a679',
          cream: '#faf9f5',
          green: '#34503f',
          gold: '#a8763f'
        }
      },
      fontFamily: {
        serif: ['Newsreader', 'Georgia', 'serif'],
        sans: ['Hanken Grotesk', '-apple-system', 'sans-serif'],
        mono: ['Spline Sans Mono', 'monospace']
      }
    }
  },
  plugins: []
};
