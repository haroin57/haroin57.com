/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Space Grotesk"', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      colors: {
        ink: '#515151',
        accent: '#22d3ee',
        accentSoft: '#b9e6ff',
        accentAlt: '#34d399',
      },
      boxShadow: {
        glow: '0 20px 60px -30px rgba(14,165,233,0.55)',
      },
    },
  },
  plugins: [],
}
