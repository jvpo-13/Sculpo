import type { Config } from 'tailwindcss';

// Paleta da Parte 7.1 do spec.
const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        fundo: '#0F1115',
        painel: '#181B20',
        borda: '#2A2F3A',
        destaque: '#E06D53',
        texto: '#E6E8EC',
        apoio: '#9AA1AD',
      },
      fontFamily: {
        sans: ['system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      screens: {
        // Abaixo de 900px o painel desce para baixo do viewport.
        largo: '900px',
      },
    },
  },
  plugins: [],
};

export default config;
