/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        saddle: {
          ink: '#2a2018', // primary text / headings
          brown: '#5b3a24', // accent brown (links, prices, outlines)
          'brown-deep': '#3a2416',
          tan: '#c9a679',
          'tan-line': '#c3a06f',
          cream: '#f4ede0', // page background
          sand: '#efe6d5', // banded sections
          paper: '#fffdf8', // cards
          line: '#d9cbb3', // borders
          nav: '#3f342a',
          body: '#5a4d3f',
          muted: '#6a5d4d',
          faint: '#8a7a64',
          green: '#34503f',
          'green-dark': '#2a4132',
          'green-mist': '#cfd8ce',
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
