import { describe, it, expect } from 'vitest';
import { validateQuestions } from './validation';

const mk = (over: any = {}) => ({
  text: 'Q',
  type: 'multiple_choice' as const,
  options: 'A\nB',
  correctAnswer: 'A',
  points: '10',
  ...over,
});

describe('validateQuestions', () => {
  it('flags when points exceed total', () => {
    const issues = validateQuestions([mk({ points: '70' })], 50);
    expect(issues.some(i => i.message.includes('exceed'))).toBe(true);
  });

  it('flags multiple-choice whose correctAnswer is not in options', () => {
    const issues = validateQuestions([mk({ correctAnswer: 'Z' })], 100);
    expect(issues.some(i => i.message.includes('one of the options'))).toBe(true);
  });

  it('returns no issues for a valid question set', () => {
    const issues = validateQuestions([mk(), mk({ type: 'true_false', options: '', correctAnswer: 'true' })], 100);
    expect(issues).toHaveLength(0);
  });
});