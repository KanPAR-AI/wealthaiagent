import { createBlockRegistry, readDataBlock, splitDataBlocks } from '../block-registry';

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

describe('splitDataBlocks — text runs and data blocks, in stream order', () => {
  const DATA = ['natal_chart', 'match_report', 'muhurta_results', 'input_request'];

  it('returns one text run when there is no fence at all', () => {
    expect(splitDataBlocks('Your Moon sits in Gemini.')).toEqual([
      { kind: 'text', text: 'Your Moon sits in Gemini.' },
    ]);
  });

  it('splits a block out of the prose around it, keeping the order', () => {
    const text =
      'Here is your chart.\n\n```natal_chart\n{"type":"natal_chart","moon_sign":"Gemini"}\n```\n\nAnd what it means.';
    const out = splitDataBlocks(text);
    expect(out.map((s) => s.kind)).toEqual(['text', 'block', 'text']);
    expect(out[0]).toEqual({ kind: 'text', text: 'Here is your chart.\n\n' });
    expect(out[1]).toEqual({
      kind: 'block',
      type: 'natal_chart',
      value: { type: 'natal_chart', moon_sign: 'Gemini' },
    });
    expect(out[2]).toEqual({ kind: 'text', text: '\n\nAnd what it means.' });
  });

  it('leaves an ordinary code fence in the text where it belongs', () => {
    // `readDataBlock`'s rule, unchanged: the fence language must equal the
    // body's own `type`. A ```json fence is code a user is meant to read.
    const text = 'Like so:\n\n```json\n{"type":"natal_chart"}\n```\n';
    expect(splitDataBlocks(text)).toEqual([{ kind: 'text', text }]);
  });

  it('recognises a hallucinated fence language when the body agrees with it', () => {
    // `prompts.py:27` says out loud that the model sometimes emits ```kundli.
    // It used to reach the user as raw JSON.
    const out = splitDataBlocks('```kundli\n{"type":"kundli","ascendant":"Leo"}\n```');
    expect(out).toEqual([
      { kind: 'block', type: 'kundli', value: { type: 'kundli', ascendant: 'Leo' } },
    ]);
  });

  it('handles two blocks in one message', () => {
    const text =
      '```natal_chart\n{"type":"natal_chart"}\n```\nthen\n```muhurta_results\n{"type":"muhurta_results"}\n```';
    const out = splitDataBlocks(text);
    expect(out.map((s) => s.kind)).toEqual(['block', 'text', 'block']);
  });

  it('WITHHOLDS a half-written trailing block while it is still streaming', () => {
    // The window this closes: between the opening fence and the closing one,
    // the body is a partial JSON object at the end of the text. Rendered as
    // markdown that is raw JSON scrolling past the user — the same defect
    // this whole function exists to remove, during the stream instead of
    // after it.
    const mid = 'Casting your chart.\n\n```natal_chart\n{"type":"natal_cha';
    const out = splitDataBlocks(mid, DATA);
    expect(out).toEqual([
      { kind: 'text', text: 'Casting your chart.\n\n' },
      { kind: 'block', type: 'natal_chart', value: null },
    ]);
    // and a null value is what every renderer already treats as "draw
    // nothing", so no caller needs a special case.
    expect(out.map((s) => (s.kind === 'text' ? s.text : ''))).not.toContain('{"type"');
  });

  it('completes that same block once the closing fence arrives', () => {
    const done = 'Casting your chart.\n\n```natal_chart\n{"type":"natal_chart","moon_sign":"Gemini"}\n```';
    const out = splitDataBlocks(done, DATA);
    expect(out[1]).toEqual({
      kind: 'block',
      type: 'natal_chart',
      value: { type: 'natal_chart', moon_sign: 'Gemini' },
    });
  });

  it('does not withhold a trailing fence that is not a data language', () => {
    const mid = 'Run this:\n\n```python\nprint("hel';
    expect(splitDataBlocks(mid, DATA)).toEqual([{ kind: 'text', text: mid }]);
  });

  it('withholds nothing when the caller declares no data languages', () => {
    // The default, and the reason `apps/mobile` could adopt the shared
    // splitter with its behaviour unchanged.
    const mid = 'Casting.\n\n```natal_chart\n{"type":"natal_cha';
    expect(splitDataBlocks(mid)).toEqual([{ kind: 'text', text: mid }]);
  });

  it('is empty for empty text', () => {
    expect(splitDataBlocks('')).toEqual([]);
  });
});
