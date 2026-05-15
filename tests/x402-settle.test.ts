import { describe, it, expect } from 'vitest';
import { tagBareDecimalAsDollars } from '../src/protocols/x402/settle.js';

describe('tagBareDecimalAsDollars', () => {
  it('tags fractional dollar strings', () => {
    expect(tagBareDecimalAsDollars('1.50')).toBe('$1.50');
    expect(tagBareDecimalAsDollars('0.01')).toBe('$0.01');
  });

  it('tags whole-dollar strings', () => {
    expect(tagBareDecimalAsDollars('1')).toBe('$1');
    expect(tagBareDecimalAsDollars('100')).toBe('$100');
  });

  it('tags amounts with more than 6 decimal places', () => {
    expect(tagBareDecimalAsDollars('1.1234567')).toBe('$1.1234567');
  });

  it('leaves already-tagged amounts untouched', () => {
    expect(tagBareDecimalAsDollars('$1.50')).toBe('$1.50');
  });

  it('leaves non-decimal strings untouched', () => {
    expect(tagBareDecimalAsDollars('abc')).toBe('abc');
    expect(tagBareDecimalAsDollars('1.')).toBe('1.');
    expect(tagBareDecimalAsDollars('.5')).toBe('.5');
  });
});
