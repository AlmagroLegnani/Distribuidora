import { generateAccessCode } from '../accessCode';

describe('generateAccessCode', () => {
  it('generates an 8-character code by default', () => {
    expect(generateAccessCode()).toHaveLength(8);
  });

  it('respects a custom length', () => {
    expect(generateAccessCode(12)).toHaveLength(12);
  });

  it('only uses unambiguous uppercase letters and digits', () => {
    const code = generateAccessCode(200);
    expect(code).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]+$/);
    expect(code).not.toMatch(/[01OIL]/);
  });

  it('is not deterministic across calls', () => {
    const codes = new Set(Array.from({ length: 20 }, () => generateAccessCode()));
    expect(codes.size).toBeGreaterThan(1);
  });
});
