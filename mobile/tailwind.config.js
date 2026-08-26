module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        gold: {
          50: '#FEF7E6',
          100: '#FCEBC2',
          200: '#FADC8C',
          300: '#F0C75E',
          400: '#E0B042',
          500: '#C9A030',
          600: '#B0892A',
          700: '#8B6B1F',
          800: '#5E4A12',
          900: '#312608',
        },
      },
    },
  },
  plugins: [],
}
