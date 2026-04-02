import { describe, it, expect } from 'vitest';
import { parseMilitary } from '../../utils/timeUtils';

describe('parseMilitary', () => {
  it('formats 3-digit times correctly', () => {
    expect(parseMilitary('900')).toBe('09:00');
  });

  it('formats 4-digit times correctly', () => {
    expect(parseMilitary('1330')).toBe('13:30');
  });

  it('keeps already formatted or unexpected input safely', () => {
    expect(parseMilitary('09:00')).toBe('09:00');
    expect(parseMilitary('abc')).toBe('abc');
  });
});