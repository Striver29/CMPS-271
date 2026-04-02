import { describe, it, expect } from 'vitest';
import { extractCourseCodes } from '../../utils/aiSchedulerUtils';

describe('extractCourseCodes', () => {
  it('extracts valid course codes', () => {
    const result = extractCourseCodes('I want CMPS 271 and MATH201');
    expect(result).toEqual(['CMPS 271', 'MATH 201']);
  });

  it('removes duplicates', () => {
    const result = extractCourseCodes('CMPS 271 cmps271 CMPS 271');
    expect(result).toEqual(['CMPS 271']);
  });

  it('returns empty array when no valid codes exist', () => {
    const result = extractCourseCodes('hello I want something easy');
    expect(result).toEqual([]);
  });
});