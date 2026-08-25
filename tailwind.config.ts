import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef2fb',
          100: '#d7e0f5',
          200: '#b0c1eb',
          300: '#7f9adb',
          400: '#5474c7',
          500: '#3856ab',
          600: '#2a4189',
          700: '#22346d',
          800: '#1c2a56',
          900: '#141d3d',
          950: '#0c1226',
        },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px 0 rgb(15 23 42 / 0.04), 0 1px 3px 0 rgb(15 23 42 / 0.06)',
      },
    },
  },
  plugins: [],
};

export default config;
