/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'rgb(var(--bg) / <alpha-value>)',
        surface: 'rgb(var(--surface) / <alpha-value>)',
        'surface-2': 'rgb(var(--surface-2) / <alpha-value>)',
        'surface-3': 'rgb(var(--surface-3) / <alpha-value>)',
        line: 'rgb(var(--line) / <alpha-value>)',
        ink: 'rgb(var(--ink) / <alpha-value>)',
        muted: 'rgb(var(--muted) / <alpha-value>)',
        brand: {
          50: '#ECFDF5', 100: '#D1FAE5', 200: '#A7F3D0', 300: '#6EE7B7', 400: '#4ADE9F',
          500: '#34D399', 600: '#10B981', 700: '#059669', 800: '#065F46', 900: '#06261A',
        },
      },
      fontFamily: {
        display: ['Geist', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        sans: ['Geist', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"Geist Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      boxShadow: {
        card: '0 1px 0 rgb(255 255 255 / .03) inset, 0 1px 2px rgb(0 0 0 / .3)',
        lift: '0 18px 40px -16px rgb(0 0 0 / .7)',
        pop: '0 30px 80px -20px rgb(0 0 0 / .8), 0 0 0 1px rgb(255 255 255 / .06)',
        glow: '0 0 0 1px rgb(52 211 153 / .35), 0 8px 30px -8px rgb(52 211 153 / .45)',
      },
      keyframes: {
        'msg-in': { from: { opacity: 0, transform: 'translateY(6px) scale(.98)' }, to: { opacity: 1, transform: 'none' } },
        blink: { '0%, 80%, 100%': { opacity: 0.25, transform: 'translateY(0)' }, '40%': { opacity: 1, transform: 'translateY(-2px)' } },
      },
      animation: { 'msg-in': 'msg-in .22s cubic-bezier(.2,.8,.2,1) both', blink: 'blink 1.2s infinite' },
    },
  },
  plugins: [],
};
