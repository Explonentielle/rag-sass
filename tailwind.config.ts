import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Kraft-paper/stamp identity from the landing redesign
        // (app/landing.module.css's --paper/--ink/--stamp/--brass variables)
        // : reused here at the token level so the whole app picks it up
        // through its existing brand-*/slate-*/brass-* classes, instead of a
        // per-file rewrite. 500/700 match --stamp/--stampInk exactly; slate
        // 50/200/500/600/900 match --paper/--line/--inkFaint/--inkSoft/--ink
        // exactly; brass 100/500/700 match --brassSoft/--brass/--brassInk.
        brand: {
          50: '#fbefec',
          100: '#f4dcd3',
          200: '#e9c0af',
          300: '#db9d84',
          400: '#c97659',
          500: '#a8341f', // stamp, primary interactive color
          600: '#942d1b',
          700: '#7b2817', // stampInk, hover/darker
          800: '#601f12',
          900: '#47170d',
          950: '#2e0e08',
        },
        slate: {
          50: '#f3ecd9', // paper
          100: '#ebdfc0', // paperDeep
          200: '#d9cba0', // line
          300: '#c7b98a',
          400: '#a99979',
          500: '#8a7c64', // inkFaint
          600: '#5c4e3a', // inkSoft
          700: '#4a3d2c',
          800: '#332a1e',
          900: '#241b12', // ink
          950: '#16110b',
        },
        brass: {
          50: '#fbf4e6',
          100: '#f0e0b8', // brassSoft
          200: '#e2c98c',
          300: '#cdad68',
          400: '#a68a4e',
          500: '#8b6b3d', // brass
          600: '#785c34',
          700: '#60492a', // brassInk
          800: '#4a3920',
          900: '#352914',
          950: '#211a0c',
        },
      },
      fontFamily: {
        sans: ['var(--font-body)', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'Georgia', 'serif'],
        mono: ['var(--font-label)', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        // Ink-tinted (rgb(36 27 18) = --ink), not the previous neutral
        // slate-900 tint, to match the landing's --shadow color.
        card: '0 1px 2px 0 rgb(36 27 18 / 0.05), 0 2px 6px -1px rgb(36 27 18 / 0.08)',
      },
    },
  },
  plugins: [],
};

export default config;
