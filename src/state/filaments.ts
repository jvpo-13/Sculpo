import type { FilamentColor, Warning } from '../types';

// Cores do preview (Parte 7.4). Não afetam o STL.
export const FILAMENTS: { id: FilamentColor; nome: string; hex: string }[] = [
  { id: 'black', nome: 'Preto', hex: '#1A1A1A' },
  { id: 'white', nome: 'Branco', hex: '#F5F5F5' },
  { id: 'terracotta', nome: 'Terracota', hex: '#E06D53' },
  { id: 'blue', nome: 'Azul', hex: '#3B82F6' },
  { id: 'green', nome: 'Verde', hex: '#22C55E' },
  { id: 'pink', nome: 'Rosa', hex: '#EC4899' },
];

export function filamentHex(id: FilamentColor): string {
  return FILAMENTS.find((f) => f.id === id)?.hex ?? '#F5F5F5';
}

export const WARNING_TEXT: Record<Warning, string> = {
  lowContrast: 'O contraste é baixo. O resultado pode ficar sem detalhes.',
  contourFallback: 'Não achamos o contorno; usamos uma placa retangular.',
  looseParts: 'Algumas partes do desenho não se tocam. Aumente a margem ou mude o estilo.',
};
