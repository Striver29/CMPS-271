export function extractCourseCodes(text: string): string[] {
  const matches = text.toUpperCase().match(/[A-Z]{2,4}\s*\d{3}/g) ?? [];

  const normalized = matches.map(code => {
    const compact = code.replace(/\s+/g, '');
    const letters = compact.match(/[A-Z]+/)?.[0] ?? '';
    const numbers = compact.match(/\d+/)?.[0] ?? '';
    return `${letters} ${numbers}`.trim();
  });

  return [...new Set(normalized)];
}