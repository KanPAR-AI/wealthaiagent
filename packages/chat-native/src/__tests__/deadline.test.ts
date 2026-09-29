/**
 * Report 457096f8 (Arthur1203): the bug-report Submit button hung on a
 * spinner. Every await in the sheet's submit was unbounded — the token, the
 * image shrink, the multipart upload and the plain POST — and `finally` (the
 * only thing that clears `sending`) runs only once the await settles. The
 * sheet cannot be mounted in the root jest project (react-native), so the
 * bound is a pure helper driven here, and the sheet's USE of it is pinned.
 */
import fs from 'fs';
import path from 'path';

import { DeadlineError, reportFailureLine, withDeadline } from '../deadline';

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

describe('withDeadline', () => {
  it('a hung promise REJECTS at the deadline (the spinner can stop)', async () => {
    const hung = new Promise<never>(() => undefined);
    const p = withDeadline(hung, 1000, 'Uploading the report');
    const seen = p.catch((e) => e);
    await jest.advanceTimersByTimeAsync(1000);
    const e = await seen;
    expect(e).toBeInstanceOf(DeadlineError);
    expect(e.name).toBe('TimeoutError');
    expect(e.message).toMatch(/Uploading the report took longer than 1s/);
  });
  it('the abandoned work is cancelled on expiry', async () => {
    const cancel = jest.fn();
    const p = withDeadline(new Promise<never>(() => undefined), 500, 'x', cancel).catch(() => undefined);
    await jest.advanceTimersByTimeAsync(500);
    await p;
    expect(cancel).toHaveBeenCalledTimes(1);
  });
  it('in time: the value passes through and nothing is cancelled', async () => {
    const cancel = jest.fn();
    const p = withDeadline(Promise.resolve(7), 500, 'x', cancel);
    await expect(p).resolves.toBe(7);
    await jest.advanceTimersByTimeAsync(1000);
    expect(cancel).not.toHaveBeenCalled();
  });
  it('an early failure is the failure, not a timeout', async () => {
    await expect(withDeadline(Promise.reject(new Error('403')), 500, 'x')).rejects.toThrow('403');
  });
  it('a result that lands AFTER the deadline changes nothing', async () => {
    let settle!: (v: number) => void;
    const late = new Promise<number>((r) => { settle = r; });
    const p = withDeadline(late, 100, 'x').catch((e) => e);
    await jest.advanceTimersByTimeAsync(100);
    settle(1);
    expect(await p).toBeInstanceOf(DeadlineError);
  });
  it('the line for a timeout says what to do; other errors keep their words', () => {
    // Role-3, E2 round 4: a post or upload can land AFTER its deadline, so
    // "was not sent" would be false — the line says what is actually known.
    const line = reportFailureLine(new DeadlineError('x', 1000));
    expect(line).toMatch(/may not have been sent/i);
    expect(line).toMatch(/check your reports before sending it again/i);
    expect(line).not.toMatch(/was not sent/i);
    expect(reportFailureLine(new Error('Upload failed (500)'))).toBe('Upload failed (500)');
    expect(reportFailureLine({})).toBe('Try again later.');
  });
});

describe('the sheet bounds every await in submit', () => {
  const code = fs.readFileSync(path.join(__dirname, '..', 'bug-report-sheet.tsx'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const submit = code.slice(code.indexOf('const submit = async'), code.indexOf('const ready ='));

  it('found submit (anti-vacuity)', () => {
    expect(submit.length).toBeGreaterThan(500);
  });
  it('every await in submit is a withDeadline', () => {
    const awaits = submit.match(/await [^;]*/g) ?? [];
    expect(awaits.length).toBe(4);
    for (const a of awaits) expect(a).toMatch(/^await withDeadline\(/);
  });
  it('the upload is a cancellable TASK, cancelled when its deadline passes', () => {
    expect(code).not.toMatch(/\buploadAsync\(\s*getPlatform/);
    expect(submit).toMatch(/const task = createUploadTask\(/);
    expect(submit).toMatch(/task\.uploadAsync\(\), REPORT_DEADLINES\.upload, 'Uploading the report',\s*\(\) => \{ void task\.cancelAsync\(\); \}/);
  });
  it('the spinner clears on every path, and a failure is shown in words', () => {
    expect(submit).toMatch(/\} finally \{\s*setSending\(false\);\s*\}/);
    expect(submit).toContain("Alert.alert('Could not send report', reportFailureLine(e));");
  });
});
