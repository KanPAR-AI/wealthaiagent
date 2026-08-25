/** F59 — the three conditions ARE the ruling. */
import { nameToAdopt } from '../people-shapes';

describe('nameToAdopt (F59)', () => {
  it('adopts the account name only when the store has none and self exists', () => {
    expect(nameToAdopt('', true, 'Ravi Pradeep')).toBe('Ravi Pradeep');
    expect(nameToAdopt(null, true, ' Ravi ')).toBe('Ravi');
  });
  it('never overwrites a stored name', () => {
    expect(nameToAdopt('Priya', true, 'Ravi')).toBeNull();
  });
  it('never before self exists', () => {
    expect(nameToAdopt('', false, 'Ravi')).toBeNull();
  });
  it('never an email, never a local part of one', () => {
    expect(nameToAdopt('', true, 'ravi@example.com')).toBeNull();
    expect(nameToAdopt('', true, '')).toBeNull();
    expect(nameToAdopt('', true, null)).toBeNull();
  });
});
