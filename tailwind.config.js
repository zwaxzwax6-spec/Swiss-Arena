/** @type {import('tailwindcss').Config} */
const defaultTheme = require('tailwindcss/defaultTheme')

module.exports = {
  content: ['./src/**/*.{ts,tsx}', './app.html'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', ...defaultTheme.fontFamily.sans],
        serif: ['Instrument Serif', ...defaultTheme.fontFamily.serif],
      },
      colors: {
        glacier: {
          50: 'rgba(160, 210, 255, 0.06)',
          100: 'rgba(160, 210, 255, 0.12)',
          200: 'rgba(160, 210, 255, 0.20)',
          400: 'rgba(160, 210, 255, 0.40)',
          DEFAULT: 'rgba(160, 210, 255, 1)',
        },
      },
      borderRadius: {
        card: '28px',
        'card-lg': '32px',
      },
      transitionTimingFunction: {
        premium: 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
      keyframes: {
        fadeUp: {
          from: { opacity: '0', transform: 'translateY(16px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        softIn: {
          from: { opacity: '0', filter: 'blur(12px)', transform: 'translateY(12px)' },
          to: { opacity: '1', filter: 'blur(0)', transform: 'translateY(0)' },
        },
        modalIn: {
          from: { opacity: '0', transform: 'scale(0.95)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        slideIn: {
          from: { transform: 'translateX(100%)' },
          to: { transform: 'translateX(0)' },
        },
        toastIn: {
          from: { opacity: '0', transform: 'translateY(-12px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        drawCheck: {
          to: { 'stroke-dashoffset': '0' },
        },
        softPulse: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.45' },
        },
      },
      animation: {
        'fade-up': 'fadeUp 1.0s cubic-bezier(0.22, 1, 0.36, 1) both',
        'soft-in': 'softIn 1.2s cubic-bezier(0.22, 1, 0.36, 1) both',
        'modal-in': 'modalIn 0.35s cubic-bezier(0.22, 1, 0.36, 1) both',
        'slide-in': 'slideIn 0.45s cubic-bezier(0.22, 1, 0.36, 1) both',
        'toast-in': 'toastIn 0.4s cubic-bezier(0.22, 1, 0.36, 1) both',
        'soft-pulse': 'softPulse 1.8s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
