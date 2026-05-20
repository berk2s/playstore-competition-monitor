import { describe, expect, it } from 'vitest';
import { cn } from './utils';

describe('cn', () => {
  it('joins truthy class names', () => {
    expect(cn('a', 'b')).toBe('a b');
  });

  it('drops falsy values', () => {
    expect(cn('a', false, undefined, null, 'b')).toBe('a b');
  });

  it('merges conflicting tailwind utilities, last one wins', () => {
    expect(cn('p-2', 'p-4')).toBe('p-4');
  });

  it('respects conditional objects from clsx', () => {
    expect(cn('a', { b: true, c: false })).toBe('a b');
  });
});
