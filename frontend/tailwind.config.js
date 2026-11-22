/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        cream: { DEFAULT: '#FFF7EE', deep: '#FCEBDD' },
        lav: { 50: '#F5F2FF', 100: '#ECE7FF', 200: '#DCD3FF', 300: '#C4B7FB', 400: '#A897F5', 500: '#8F7BEA', 600: '#7562D6' },
        peach: { 100: '#FFEDE2', 200: '#FFD9C4', 400: '#FFB08A' },
        butter: { 100: '#FFF5D6', 300: '#FFE08A', 400: '#FFCF4D' },
        mint: { 100: '#E6F5E1', 300: '#B9E2AE', 500: '#6CBF5B' },
        ink: { DEFAULT: '#3B3541', soft: '#6E6775', mute: '#A49DAA' },
        apple: { DEFAULT: '#F2554A', dark: '#D93C33' },
      },
      fontFamily: { sans: ['Pretendard', '"Apple SD Gothic Neo"', '"Noto Sans KR"', 'system-ui', 'sans-serif'], round: ['Jua', 'Pretendard', 'system-ui', 'sans-serif'] },
      boxShadow: { card: '0 6px 20px -8px rgba(120,90,160,.25)', soft: '0 2px 10px -4px rgba(120,90,160,.2)', pop: '0 10px 30px -10px rgba(143,123,234,.55)' },
      borderRadius: { '4xl': '2rem' },
      keyframes: {
        shake: { '0%,100%': { transform: 'translateX(0)' }, '25%': { transform: 'translateX(-6px)' }, '75%': { transform: 'translateX(6px)' } },
        pop: { '0%': { transform: 'scale(.6)', opacity: '0' }, '60%': { transform: 'scale(1.08)', opacity: '1' }, '100%': { transform: 'scale(1)' } },
        ring: { '0%,100%': { transform: 'rotate(0)' }, '20%': { transform: 'rotate(-14deg)' }, '40%': { transform: 'rotate(12deg)' }, '60%': { transform: 'rotate(-8deg)' }, '80%': { transform: 'rotate(5deg)' } },
        floaty: { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-6px)' } },
        fadeup: { '0%': { transform: 'translateY(8px)', opacity: '0' }, '100%': { transform: 'translateY(0)', opacity: '1' } },
      },
      animation: { shake: 'shake .3s ease', pop: 'pop .35s ease-out both', ring: 'ring .6s ease', floaty: 'floaty 3s ease-in-out infinite', fadeup: 'fadeup .3s ease-out both' },
    },
  },
  plugins: [],
}
