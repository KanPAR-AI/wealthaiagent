/**
 * ASTRAL-20 on the web surface — "null -> registry".
 *
 * The gate: "Role-4 checks the console/log on a turn carrying a synthetic
 * unknown block: exactly one warning, no user-visible artefact."
 *
 * ── what the react-markdown mock below does and does not prove ─────────────
 *
 * `react-markdown` and its unified/hast/micromark tree are ESM-only and this
 * project's jest config does not transform them (see `transformIgnorePatterns`
 * — the list is msw's tree, added one package at a time). Importing the real
 * one here fails to parse before a single assertion runs, and widening the
 * transform list to cover ~25 more packages is a change to every suite in the
 * repo, which does not belong in this phase.
 *
 * So markdown PARSING is mocked: the stand-in finds fenced blocks with a
 * regex and calls the real `components.code` that `response.tsx` builds.
 *
 * PROVEN by these tests: that `response.tsx` routes a fenced block through the
 * registry, that a registered type draws, that an unknown type warns once and
 * draws nothing, and that no raw JSON survives.
 * NOT PROVEN: that react-markdown itself hands fenced blocks to
 * `components.code`. That is unchanged framework behaviour, already relied on
 * in production by the palm widgets, and is covered by the Playwright specs.
 */

jest.mock('react-markdown', () => ({
  __esModule: true,
  default: ({ children, components }: any) => {
    const md = String(children ?? '');
    const parts: any[] = [];
    const fence = /```(\w+)?\n([\s\S]*?)```/g;
    let last = 0;
    let m: RegExpExecArray | null;
    let key = 0;
    while ((m = fence.exec(md)) !== null) {
      if (m.index > last) parts.push(<p key={`t${key++}`}>{md.slice(last, m.index)}</p>);
      const Code = components.code;
      parts.push(
        <Code key={`c${key++}`} className={m[1] ? `language-${m[1]}` : undefined}>
          {m[2]}
        </Code>,
      );
      last = m.index + m[0].length;
    }
    if (last < md.length) parts.push(<p key={`t${key++}`}>{md.slice(last)}</p>);
    return <div>{parts}</div>;
  },
}));
jest.mock('remark-gfm', () => ({ __esModule: true, default: () => undefined }));
jest.mock('rehype-raw', () => ({ __esModule: true, default: () => undefined }));

import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { natalTimedPayload, natalTimelessPayload } from '@wealthai/astral/fixtures';

import { Response } from '@/components/chat/response';
import { renderCodeBlock, responseBlockRegistry } from '@/components/chat/block-registry';

function fence(lang: string, body: unknown) {
  return '```' + lang + '\n' + JSON.stringify(body) + '\n```\n\nSome prose after.';
}

function renderResponse(markdown: string) {
  return render(
    <MemoryRouter>
      <Response isStreaming={false}>{markdown}</Response>
    </MemoryRouter>,
  );
}

describe('ASTRAL-20 — unknown block types are logged, not silently dropped', () => {
  let warn: jest.SpyInstance;

  beforeEach(() => {
    responseBlockRegistry.resetWarnings();
    warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => warn.mockRestore());

  it('renders nothing for an unregistered data block and warns exactly once', () => {
    const { container } = renderResponse(
      fence('western_chart', { type: 'western_chart', ascendant: 'Leo' }),
    );
    expect(container.textContent).not.toContain('western_chart');
    expect(container.textContent).not.toContain('Leo');
    expect(container.textContent).toContain('Some prose after.');

    const astralWarnings = warn.mock.calls.filter((c) =>
      String(c[0]).includes('western_chart'),
    );
    expect(astralWarnings).toHaveLength(1);
  });

  it('warns once even when the same unknown block arrives repeatedly', () => {
    const block = fence('western_chart', { type: 'western_chart' });
    renderResponse(block + '\n' + block);
    renderResponse(block);
    const astralWarnings = warn.mock.calls.filter((c) =>
      String(c[0]).includes('western_chart'),
    );
    expect(astralWarnings).toHaveLength(1);
  });

  it('does not warn for a registered type', () => {
    renderResponse(fence('natal_chart', natalTimedPayload));
    expect(warn).not.toHaveBeenCalled();
  });

  it('does not warn for ordinary code the user is meant to read', () => {
    const { container } = renderResponse('```python\nprint("hi")\n```');
    expect(warn).not.toHaveBeenCalled();
    expect(container.textContent).toContain('print("hi")');
  });

  it('never shows raw JSON to the user, registered or not', () => {
    for (const markdown of [
      fence('western_chart', { type: 'western_chart', secret: 'value' }),
      fence('kundli', { type: 'kundli', ascendant: 'Leo' }),
      '```natal_chart\n{"type":"natal_chart", TRUNCATED\n```',
    ]) {
      const { container } = renderResponse(markdown);
      expect(container.textContent).not.toContain('{"type"');
      expect(container.textContent).not.toContain('TRUNCATED');
    }
  });
});

describe('ASTRAL-15/16/17 — the three blocks reach the screen through Response', () => {
  it('renders a natal chart where the fence used to render null', () => {
    const { getByTestId } = renderResponse(fence('natal_chart', natalTimedPayload));
    expect(getByTestId('astral-natal-chart')).toBeInTheDocument();
    expect(getByTestId('astral-natal-wheel')).toBeInTheDocument();
  });

  it('renders a time-less chart with no wheel and the stated reason', () => {
    const { getByTestId, queryByTestId } = renderResponse(
      fence('natal_chart', natalTimelessPayload),
    );
    expect(getByTestId('astral-natal-chart')).toBeInTheDocument();
    expect(queryByTestId('astral-natal-wheel')).toBeNull();
    expect(getByTestId('astral-natal-no-time')).toBeInTheDocument();
  });
});

describe('renderCodeBlock — the dispatch contract', () => {
  beforeEach(() => responseBlockRegistry.resetWarnings());

  it('leaves an ordinary fence unhandled so it renders as code', () => {
    expect(renderCodeBlock('json', '{"a":1}', { isStreaming: true }).handled).toBe(false);
    expect(renderCodeBlock(undefined, 'inline', { isStreaming: true }).handled).toBe(false);
  });

  it('consumes a registered fence whose body is malformed, rendering nothing', () => {
    const outcome = renderCodeBlock('natal_chart', '{ not json', { isStreaming: true });
    expect(outcome.handled).toBe(true);
    expect(outcome.node).toBeNull();
  });

  it('registers every block type the client can draw', () => {
    expect(responseBlockRegistry.types().sort()).toEqual([
      'bedtime_video',
      'match_report',
      'muhurta_results',
      'natal_chart',
      'palm_analysis',
      'palm_predictions',
      'palm_scanning',
    ]);
  });
});
