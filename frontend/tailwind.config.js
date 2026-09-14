/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#fdfbf7', // Soft warm off-white
        sidebar: '#1c3829', // Deep Forest Green
        card: '#ffffff', // Pure white
        cardHover: '#f5f3ed', // Very soft tan/gray for hover
        cardActive: '#ebe7de', // Slightly darker tan for active
        subtle: '#e8e4db', // Borders
        medium: '#c9c3b8',
        emeraldMain: '#2a9d8f', // Vibrant leaf green
        textMain: '#2b2824', // Deep espresso brown
        textSub: '#706a5c', // Softer grayish brown
        textMuted: '#9e9789',
        danger: '#e76f51', // Terracotta red/orange
        warning: '#f4a261', // Peach/orange
        success: '#2a9d8f'
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
}
