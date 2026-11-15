import { describe, expect, it } from 'vitest';
import { MAX_FILE_BYTES, MSG_FORMAT, MSG_TOO_BIG, validateFile } from '../validate';

const bytes = (...b: number[]) => Uint8Array.from(b);
const PNG = bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13);
const JPEG = bytes(0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0, 1);
const WEBP = Uint8Array.from('RIFF\x10\x00\x00\x00WEBP', (c) => c.charCodeAt(0));
const GIF = Uint8Array.from('GIF89a\x01\x00\x01\x00\x00\x00', (c) => c.charCodeAt(0));

describe('validateFile', () => {
  it('aceita PNG, JPEG e WebP', () => {
    expect(validateFile('image/png', 1000, PNG)).toBeNull();
    expect(validateFile('image/jpeg', 1000, JPEG)).toBeNull();
    expect(validateFile('image/webp', 1000, WEBP)).toBeNull();
  });

  it('rejeita acima de 8 MB, mas aceita exatamente 8 MB', () => {
    expect(validateFile('image/png', MAX_FILE_BYTES, PNG)).toBeNull();
    expect(validateFile('image/png', MAX_FILE_BYTES + 1, PNG)).toBe(MSG_TOO_BIG);
  });

  it('rejeita GIF, SVG e BMP', () => {
    expect(validateFile('image/gif', 1000, GIF)).toBe(MSG_FORMAT);
    expect(validateFile('image/svg+xml', 1000, Uint8Array.from('<svg xmlns=', (c) => c.charCodeAt(0)))).toBe(MSG_FORMAT);
    expect(validateFile('image/bmp', 1000, bytes(0x42, 0x4d, 0, 0))).toBe(MSG_FORMAT);
  });

  it('confere o tipo E os bytes: um não basta sem o outro', () => {
    expect(validateFile('image/png', 1000, GIF)).toBe(MSG_FORMAT); // GIF renomeado
    expect(validateFile('image/gif', 1000, PNG)).toBe(MSG_FORMAT);
    expect(validateFile('', 1000, PNG)).toBe(MSG_FORMAT);
    expect(validateFile('image/png', 3, bytes(0x89, 0x50, 0x4e))).toBe(MSG_FORMAT);
    // "RIFF" sem "WEBP" (ex.: WAV) não passa.
    expect(validateFile('image/webp', 1000, Uint8Array.from('RIFF\x10\x00\x00\x00WAVE', (c) => c.charCodeAt(0)))).toBe(MSG_FORMAT);
  });
});
