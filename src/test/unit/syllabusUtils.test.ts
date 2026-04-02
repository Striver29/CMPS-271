import { describe, it, expect } from 'vitest';
import { validateSyllabusFile } from '../../utils/syllabusUtils';

describe('validateSyllabusFile', () => {
  it('rejects non-PDF files', () => {
    const file = new File(['hello'], 'test.txt', { type: 'text/plain' });
    expect(validateSyllabusFile(file)).toBe('Only PDF files are allowed.');
  });

  it('rejects files over 10MB', () => {
    const bigContent = new Uint8Array(10 * 1024 * 1024 + 1);
    const file = new File([bigContent], 'big.pdf', { type: 'application/pdf' });
    expect(validateSyllabusFile(file)).toBe('File must be under 10MB.');
  });

  it('accepts valid PDF files', () => {
    const file = new File(['small'], 'ok.pdf', { type: 'application/pdf' });
    expect(validateSyllabusFile(file)).toBe(null);
  });
});