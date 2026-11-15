// Parte 3.1: validação do arquivo antes de qualquer processamento.

export const MAX_FILE_BYTES = 8 * 1024 * 1024;
export const HEADER_BYTES = 12;

export const MSG_TOO_BIG = 'Arquivo muito grande. O limite é 8 MB.';
export const MSG_FORMAT = 'Formato não suportado. Use PNG, JPEG ou WebP.';
export const MSG_OLD_BROWSER = 'Seu navegador é antigo demais. Atualize para usar o Sculpo.';

const TYPES = ['image/png', 'image/jpeg', 'image/webp'];

function hasMagic(head: Uint8Array): boolean {
  const at = (k: number) => head[k] ?? -1;
  const png = at(0) === 0x89 && at(1) === 0x50 && at(2) === 0x4e && at(3) === 0x47;
  const jpeg = at(0) === 0xff && at(1) === 0xd8 && at(2) === 0xff;
  // "RIFF....WEBP"
  const webp =
    at(0) === 0x52 && at(1) === 0x49 && at(2) === 0x46 && at(3) === 0x46 &&
    at(8) === 0x57 && at(9) === 0x45 && at(10) === 0x42 && at(11) === 0x50;
  return png || jpeg || webp;
}

/**
 * Devolve a mensagem de erro ou null se o arquivo pode seguir.
 * Confere o tipo declarado E os primeiros bytes. Não rejeita por dimensão.
 */
export function validateFile(type: string, size: number, head: Uint8Array): string | null {
  if (size > MAX_FILE_BYTES) return MSG_TOO_BIG;
  if (!TYPES.includes(type) || !hasMagic(head)) return MSG_FORMAT;
  return null;
}
