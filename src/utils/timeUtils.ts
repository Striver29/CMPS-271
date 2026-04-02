export function parseMilitary(t: string): string {
  const s = t.trim().replace(':', '');

  if (!/^\d+$/.test(s)) {
    return t.trim();
  }

  if (s.length === 3) return `0${s[0]}:${s.slice(1)}`;
  if (s.length === 4) return `${s.slice(0, 2)}:${s.slice(2)}`;

  return t.trim();
}