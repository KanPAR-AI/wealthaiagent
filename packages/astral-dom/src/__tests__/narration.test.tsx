/**
 * docs/73 B4 — the engine's narration is rendered as what it is.
 *
 * The text in `NARRATION` is the shape `_compose_synastry` actually sends,
 * taken from the stream captured on 2026-09-19: a bolded name, a `####`
 * heading and a GitHub-flavoured koota table. Printed into a `<p>` it reads
 * as `**Pune**'s birth details … || Yoni | 2/4 |`, which is what shipped in
 * PH-39's first cut.
 *
 * The two claims worth pinning: markdown becomes ELEMENTS, and the renderer
 * changes none of the engine's words.
 */

import { MessageChannel } from 'worker_threads';

import { render } from '@testing-library/react';

import { Narration, resetNarrationWarnings } from '../narration';

/**
 * `react-dom/server.browser` reaches for `MessageChannel` at module load and
 * jsdom does not have one. Node does — this is a gap in the test
 * environment, not in the product, so it is filled here rather than worked
 * around by testing something weaker.
 *
 * Required LAZILY for the same reason: an `import` would be hoisted above
 * this assignment and the module would throw before it ran.
 */
(globalThis as unknown as { MessageChannel?: unknown }).MessageChannel ??= MessageChannel;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { renderToStaticMarkup } = require('react-dom/server') as typeof import('react-dom/server');

const NARRATION = [
  "Those are **Pune**'s birth details (1992-03-14, 10:30) — I have **not** written them to your own profile.",
  '',
  '#### Kundli Milan — 26 / 36 (very good)',
  '',
  '| Koota | Score | What it reads |',
  '|---|---|---|',
  '| Varna | 1/1 | spiritual compatibility & ego balance |',
  '| Nadi | 8/8 | health & progeny |',
  '',
  '- one bullet',
  '- another bullet',
].join('\n');

function draw(text = NARRATION) {
  return render(
    <Narration
      text={text}
      color="#a49db4"
      strongColor="#f2eefb"
      lineColor="#332c42"
      width={380}
      testID="narration"
    />,
  );
}

describe('markdown becomes elements, not punctuation', () => {
  it('draws bold as <strong> and not as asterisks', () => {
    const { container } = draw();
    expect(container.querySelectorAll('strong').length).toBeGreaterThanOrEqual(2);
    expect(container.textContent).not.toContain('**');
  });

  it('draws the heading as a heading, not as hashes', () => {
    const { container } = draw();
    const heading = container.querySelector('h4, h3');
    expect(heading?.textContent).toContain('Kundli Milan');
    expect(container.textContent).not.toContain('####');
  });

  it('draws the table as a table, not as pipes', () => {
    const { container } = draw();
    expect(container.querySelectorAll('table')).toHaveLength(1);
    expect(container.querySelectorAll('th')).toHaveLength(3);
    expect(container.querySelectorAll('tbody tr')).toHaveLength(2);
    expect(container.textContent).not.toContain('|---|');
    expect(container.textContent).not.toContain('| Varna |');
  });

  it('draws a list as a list', () => {
    const { container } = draw();
    expect(container.querySelectorAll('li')).toHaveLength(2);
  });
});

describe('the words are the engine\'s, unchanged', () => {
  it('keeps every sentence it was given', () => {
    const { container } = draw();
    const text = container.textContent ?? '';
    expect(text).toContain("Those are Pune's birth details");
    expect(text).toContain('written them to your own profile');
    expect(text).toContain('Kundli Milan — 26 / 36 (very good)');
    // the numbers the engine computed, still there
    expect(text).toContain('1/1');
    expect(text).toContain('8/8');
  });

  it('adds no sentence of its own', () => {
    const { container } = draw('Just one line.');
    expect((container.textContent ?? '').trim()).toBe('Just one line.');
  });

  it('draws nothing at all for empty text', () => {
    const { container } = draw('   ');
    expect(container.innerHTML).toBe('');
  });
});

describe('at 380 px the table scrolls, and the reading does not', () => {
  it('wraps every table in its own scroller', () => {
    const { getByTestId } = draw();
    const scroller = getByTestId('narration-table-scroller');
    expect(scroller.style.overflowX).toBe('auto');
    expect(scroller.style.maxWidth).toBe('100%');
  });

  it('bounds itself to the column it was given', () => {
    const { getByTestId } = draw();
    expect(getByTestId('narration').style.maxWidth).toBe('380px');
  });
});

describe('a fenced block that reached the prose is reported, not drawn', () => {
  beforeEach(() => resetNarrationWarnings());

  it('renders nothing and warns once, by name', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const { container } = draw('Here it is:\n\n```match_report\n{"type":"match_report"}\n```\n');
    expect(container.textContent).not.toContain('match_report');
    expect(container.textContent).not.toContain('{');
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });
});

/**
 * ── nothing in a reading may make a REQUEST (B4, safety) ──────────────────
 *
 * The narration is a model's words about text the user pasted off somebody
 * else's page, so every string in it is attacker-influenced. These use
 * `renderToStaticMarkup` rather than the DOM renderer because the question is
 * what MARKUP is produced — a `<link rel=preload>` React 19 emits for an
 * image never lands in a jsdom container but does land in a real page.
 */
describe('nothing here fetches anything', () => {
  const markup = (text: string) =>
    renderToStaticMarkup(
      <Narration
        text={text}
        color="#a49db4"
        strongColor="#f2eefb"
        lineColor="#332c42"
        width={380}
      />,
    );

  it('renders NO element for a remote image, and never its URL', () => {
    const out = markup('Here they are: ![their photo](https://tracker.example/pixel.png)');
    expect(out).not.toContain('<img');
    expect(out).not.toContain('preload');
    expect(out).not.toContain('tracker.example');
    expect(out).not.toContain('pixel.png');
    // the alt text survives as TEXT, so nothing is silently dropped
    expect(out).toContain('their photo');
  });

  it('renders no element for a data: image either', () => {
    const out = markup('![x](data:image/png;base64,iVBORw0KGgo=)');
    expect(out).not.toContain('<img');
    expect(out).not.toContain('base64');
    expect(out).not.toContain('data:image');
  });

  it('renders an image with no alt as nothing at all', () => {
    const out = markup('![](https://tracker.example/pixel.png)');
    expect(out).not.toContain('<img');
    expect(out).not.toContain('tracker.example');
  });

  it('makes a javascript: link inert — a span, with no href', () => {
    const out = markup('[click me](javascript:alert(1))');
    expect(out).not.toContain('<a');
    expect(out).not.toContain('href');
    expect(out).not.toContain('javascript:');
    expect(out).toContain('click me');
  });

  it('makes an ordinary link inert too, keeping its words', () => {
    const out = markup('[their profile](https://example.com/profile/12345)');
    expect(out).not.toContain('<a');
    expect(out).not.toContain('example.com');
    expect(out).toContain('their profile');
  });

  it('makes a GFM AUTOLINK inert — a bare URL is still a link to remark', () => {
    const out = markup('Read more at https://tracker.example/x?u=42 today.');
    expect(out).not.toContain('<a');
    expect(out).not.toContain('href');
  });

  it('escapes raw HTML rather than parsing it', () => {
    const out = markup('<img src=x onerror="fetch(\'https://tracker.example\')"> and after');
    expect(out).not.toContain('<img');
    // no ELEMENT carries the handler; the characters appear only inside an
    // escaped text node, which is what "not parsed" looks like in markup
    expect(out).not.toMatch(/<[a-z]+[^>]*onerror/i);
    expect(out).toContain('&lt;img');
    expect(out).toContain('and after');
  });

  it('escapes a raw <script> the same way', () => {
    const out = markup('<script>fetch("https://tracker.example")</script>');
    expect(out).not.toContain('<script');
    expect(out).toContain('&lt;script');
  });

  it('produces no src, href, srcset or background anywhere, on real narration', () => {
    const out = markup(NARRATION);
    for (const attribute of ['src=', 'href=', 'srcset=', 'background:url', 'url(']) {
      expect(out).not.toContain(attribute);
    }
  });
});
