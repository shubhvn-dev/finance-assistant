import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#f0f4ff',
          100: '#dce4f8',
          200: '#b8c9f0',
          300: '#8ba8e8',
          400: '#5e87df',
          500: '#3a6bd6',
          600: '#2952b0',
          700: '#1e3d8a',
          800: '#142a64',
          900: '#0c1a3e',
        },
        cream: {
          50:  '#fefdfb',
          100: '#faf8f5',
          200: '#f0ece6',
        },
        score: {
          green:  '#16a34a',
          yellow: '#ca8a04',
          red:    '#dc2626',
        },
      },
      fontFamily: {
        display: ['var(--font-display)', 'Georgia', 'serif'],
        body:    ['var(--font-body)', 'sans-serif'],
      },
      animation: {
        'fade-up': 'fade-up 0.6s ease-out forwards',
        'bar-fill': 'bar-fill 1s ease-out 0.3s forwards',
        'pulse-soft': 'pulse-soft 2s ease-in-out infinite',
        'float': 'float 3s ease-in-out infinite',
      },
      keyframes: {
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(20px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'bar-fill': {
          from: { width: '0' },
          to: { width: 'var(--bar-width)' },
        },
        'pulse-soft': {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(58,107,214,0.2)' },
          '50%': { boxShadow: '0 0 0 12px rgba(58,107,214,0)' },
        },
        'float': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-6px)' },
        },
      },
    },
  },
  plugins: [],
};
export default config;
