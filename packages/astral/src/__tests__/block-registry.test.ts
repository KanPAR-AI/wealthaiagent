import { createBlockRegistry, readDataBlock } from '../block-registry';

describe('createBlockRegistry — docs/49 ASTRAL-20', () => {
  it('warns exactly once for an unregistered type, however many blocks arrive', () => {
    const warn = jest.fn();
    const reg = createBlockRegistry<string>({ natal_chart: 'ok' }, { surface: 'test', warn });

    expect(reg.reportUnknown('transit_report')).toBe(true);
    expect(reg.reportUnknown('transit_report')).toBe(false);
    expect(reg.reportUnknown('transit_report')).toBe(false);

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain('transit_report');
  });

  it('names the surface and the type, so the warning is actionable', () => {
    const warn = jest.fn();
    const reg = createBlockRegistry<string>({}, { surface: 'response', warn });
    reg.reportUnknown('western_chart');
    expect(warn.mock.calls[0][0]).toContain('[astral/response]');
    expect(warn.mock.calls[0][0]).toContain('western_chart');
    expect(warn.mock.calls[0][0]).toContain('ASTRAL-20');
  });

  it('warns once PER TYPE, not once in total', () => {
    const warn = jest.fn();
    const reg = createBlockRegistry<string>({}, { surface: 'test', warn });
    reg.reportUnknown('a');
    reg.reportUnknown('b');
    reg.reportUnknown('a');
    expect(warn).toHaveBeenCalledTimes(2);
  });

  it('does not warn for a registered type', () => {
    const warn = jest.fn();
    const reg = createBlockRegistry<string>({ natal_chart: 'ok' }, { surface: 'test', warn });
    expect(reg.has('natal_chart')).toBe(true);
    expect(reg.get('natal_chart')).toBe('ok');
    expect(warn).not.toHaveBeenCalled();
  });

  it('resetWarnings is a test seam and really resets', () => {
    const warn = jest.fn();
    const reg = createBlockRegistry<string>({}, { surface: 'test', warn });
    reg.reportUnknown('x');
    reg.resetWarnings();
    reg.reportUnknown('x');
    expect(warn).toHaveBeenCalledTimes(2);
  });

  it('lists its registered types for the structural tests', () => {
    const reg = createBlockRegistry<string>({ a: '1', b: '2' }, { surface: 'test' });
    expect(reg.types().sort()).toEqual(['a', 'b']);
  });
});

describe('readDataBlock — which fences are data', () => {
  it('recognises the backend convention: fence language equals the JSON type', () => {
    const block = readDataBlock('natal_chart', '{"type":"natal_chart","moon_sign":"Gemini"}');
    expect(block).not.toBeNull();
    expect(block!.type).toBe('natal_chart');
  });

  it('recognises a hallucinated ```kundli fence as data, so it is suppressed', () => {
    // prompts.py:27 says out loud that the model sometimes emits one, and that
    // the user then "sees raw JSON in the chat, which is a bug".
    expect(readDataBlock('kundli', '{"type":"kundli","ascendant":"Leo"}')).not.toBeNull();
  });

  it('leaves an ordinary ```json fence alone', () => {
    expect(readDataBlock('json', '{"type":"natal_chart"}')).toBeNull();
  });

  it('leaves a ```python fence alone', () => {
    expect(readDataBlock('python', 'print("hello")')).toBeNull();
  });

  it('leaves an inline code span (no language) alone', () => {
    expect(readDataBlock(undefined, '{"type":"natal_chart"}')).toBeNull();
  });

  it('is null for a fence whose body is not JSON — mid-stream truncation', () => {
    expect(readDataBlock('natal_chart', '{"type":"natal_ch')).toBeNull();
  });

  it('is null for a JSON array or a JSON scalar', () => {
    expect(readDataBlock('natal_chart', '[1,2,3]')).toBeNull();
    expect(readDataBlock('natal_chart', '"natal_chart"')).toBeNull();
  });
});
