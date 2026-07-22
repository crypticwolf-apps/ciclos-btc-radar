/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Paleta semántica del dashboard. Se mapea a variables CSS para
        // soportar modo claro/oscuro sin duplicar clases (ver index.css).
        btc: {
          DEFAULT: '#f59e0b',
          50: '#fffbeb',
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#ea580c',
          700: '#c2410c',
        },
        bull: { DEFAULT: '#22c55e', soft: '#4ade80', deep: '#16a34a' },
        bear: { DEFAULT: '#ef4444', soft: '#f87171', deep: '#dc2626' },
        macro: { DEFAULT: '#3b82f6', soft: '#60a5fa', deep: '#2563eb' },
        violet: { DEFAULT: '#8b5cf6' },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'scale-in': {
          '0%': { opacity: '0', transform: 'scale(0.96)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
        'pulse-ring': {
          '0%': { boxShadow: '0 0 0 0 rgba(34,197,94,0.5)' },
          '70%': { boxShadow: '0 0 0 10px rgba(34,197,94,0)' },
          '100%': { boxShadow: '0 0 0 0 rgba(34,197,94,0)' },
        },
        'count-up': {
          '0%': { opacity: '0.4' },
          '100%': { opacity: '1' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.5s cubic-bezier(0.22,1,0.36,1) both',
        'scale-in': 'scale-in 0.4s cubic-bezier(0.22,1,0.36,1) both',
        shimmer: 'shimmer 1.6s infinite',
        'pulse-ring': 'pulse-ring 2s infinite',
        'count-up': 'count-up 0.6s ease-out both',
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
};
