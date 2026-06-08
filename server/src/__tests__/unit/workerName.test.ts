import { isValidWorkerScriptName, normalizeWorkerScriptName } from '../../utils/workerName';

describe('isValidWorkerScriptName', () => {
  it('accepts lowercase letters', () => {
    expect(isValidWorkerScriptName('mybalancer')).toBe(true);
  });

  it('accepts lowercase letters, numbers, and hyphens', () => {
    expect(isValidWorkerScriptName('my-lb-1')).toBe(true);
    expect(isValidWorkerScriptName('loadbalancer-prod-2')).toBe(true);
  });

  it('rejects uppercase letters', () => {
    expect(isValidWorkerScriptName('MyLB')).toBe(false);
    expect(isValidWorkerScriptName('UPPER')).toBe(false);
  });

  it('rejects spaces', () => {
    expect(isValidWorkerScriptName('my lb')).toBe(false);
  });

  it('rejects underscores', () => {
    expect(isValidWorkerScriptName('my_lb')).toBe(false);
  });

  it('rejects dots', () => {
    expect(isValidWorkerScriptName('my.lb')).toBe(false);
  });

  it('rejects empty string', () => {
    expect(isValidWorkerScriptName('')).toBe(false);
  });
});

describe('normalizeWorkerScriptName', () => {
  it('trims leading and trailing whitespace', () => {
    expect(normalizeWorkerScriptName('  my-lb  ')).toBe('my-lb');
  });

  it('preserves already-clean names', () => {
    expect(normalizeWorkerScriptName('clean-name')).toBe('clean-name');
  });
});
