import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Forest/brass identity from the landing redesign (app/landing.module.css)
        // — reused here at the token level so the whole app picks it up through
        // its existing brand-*/slate-* classes, instead of a per-file rewrite.
        brand: {
          50: '#eaf1ec',
          100: '#e1ebe3',
          200: '#c3d9c9',
          300: '#9ec2a8',
          400: '#6fa47f',
          500: '#468560',
          600: '#2d6e50',
          700: '#1f5c46', // forest — primary interactive color
          800: '#163f31', // forestInk — hover/darker
          900: '#102d24',
          950: '#0a1e19',
        },
        slate: {
          50: '#f8f8f3',
          100: '#eef0e8',
          200: '#d8dcce',
          300: '#c0c7b4',
          400: '#9ba593',
          500: '#838f82', // inkFaint
          600: '#67715f',
          700: '#4a564c', // inkSoft
          800: '#303d34',
          900: '#16231c', // ink
          950: '#0d1511',
        },
        brass: {
          50: '#f4e9d3',
          100: '#ecdbb3',
          200: '#dcc084',
          300: '#c9a35c',
          400: '#b78c40',
          500: '#a9782e', // brass — secondary/CTA accent
          600: '#8f6527',
          700: '#7a5a22', // brassInk
          800: '#5f451a',
          900: '#473413',
        },
      },
      fontFamily: {
        sans: ['var(--font-body)', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'Georgia', 'serif'],
        mono: ['var(--font-label)', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        card: '0 1px 2px 0 rgb(15 23 42 / 0.04), 0 1px 3px 0 rgb(15 23 42 / 0.06)',
      },
    },
  },
  plugins: [],
};

export default config;
