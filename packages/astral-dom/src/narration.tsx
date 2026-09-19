/**
 * The engine's narration, rendered as what it is (docs/73 B4).
 *
 * ── what this is for ──────────────────────────────────────────────────────
 *
 * `_compose_synastry` writes MARKDOWN: `**bold**`, `###` headings, and a
 * GitHub-flavoured table of the kootas. Printed into a `<p>` it arrives as
 * `**Pune**'s birth details … #### Kundli Milan … || Yoni | 2/4 |` — a wall
 * of punctuation under a scorecard that already drew the same numbers
 * properly. That is what shipped in PH-39's first cut, and it is a
 * presentation bug with a product cost: the reading looks broken.
 *
 * ── what it must NOT do ───────────────────────────────────────────────────
 *
 * It renders the engine's sentences and changes none of them. No stripping,
 * no summarising, no dropping the duplicate table — the duplication is being
 * fixed ENGINE-side, where the sentence is written. A client that edited the
 * narration would be a second author of the reading, and the next person to
 * read a transcript could not tell which words were the engine's.
 *
 * ── and the 380 px constraint ────────────────────────────────────────────
 *
 * A markdown table does not fit in a side panel and must not push the rest of
 * the column sideways. Every table is wrapped in its own scroller, so the
 * table scrolls and the reading does not.
 *
 * No remote code: `react-markdown` and `remark-gfm` are bundled from the
 * workspace's own dependencies, which is what the extension's CSP
 * (`script-src 'self'`) requires.
 *
 * ── and nothing in it may make a REQUEST ─────────────────────────────────
 *
 * This text is model output about text a user pasted from somebody else's
 * page, so it is attacker-influenced. Three doors are closed here and the
 * CSP closes them again behind this (`img-src 'self' data:`, no remote
 * `connect-src` but our own hosts):
 *
 *   - `img` renders NO element — an image is a request, and a remote one
 *     tells its host that this user is reading this profile right now;
 *   - `a` renders a span, so `javascript:` and `data:` hrefs are inert;
 *   - raw HTML is never parsed (no `rehype-raw`), so `<img onerror=…>`
 *     arrives as visible text rather than as an element.
 */

import type { CSSProperties, ReactNode } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export interface NarrationProps {
  /** the engine's text, verbatim */
  text: string;
  /** ink for body copy */
  color: string;
  /** ink for headings and bold — the emphasis the markdown asks for */
  strongColor: string;
  /** hairlines: table borders and the rule under a heading */
  lineColor: string;
  /** the column this is drawn in; 380 in the extension panel */
  width: number;
  testID?: string;
}

export function Narration({
  text,
  color,
  strongColor,
  lineColor,
  width,
  testID,
}: NarrationProps) {
  if (!text.trim()) return null;

  const body: CSSProperties = { margin: '0 0 10px', fontSize: '13px', lineHeight: 1.55, color };
  const heading: CSSProperties = {
    margin: '14px 0 6px',
    fontSize: '14px',
    fontWeight: 600,
    color: strongColor,
  };
  const cell: CSSProperties = {
    border: `1px solid ${lineColor}`,
    padding: '6px 8px',
    fontSize: '12px',
    color,
    textAlign: 'left',
    whiteSpace: 'nowrap',
  };

  return (
    <div data-testid={testID} style={{ maxWidth: `${width}px` }}>
      <Markdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => <p style={body}>{children}</p>,
          h1: ({ children }) => <h3 style={heading}>{children}</h3>,
          h2: ({ children }) => <h3 style={heading}>{children}</h3>,
          h3: ({ children }) => <h3 style={heading}>{children}</h3>,
          h4: ({ children }) => <h4 style={heading}>{children}</h4>,
          strong: ({ children }) => <strong style={{ color: strongColor }}>{children}</strong>,
          em: ({ children }) => <em style={{ color }}>{children}</em>,
          ul: ({ children }) => (
            <ul style={{ ...body, paddingLeft: '18px' }}>{children}</ul>
          ),
          ol: ({ children }) => (
            <ol style={{ ...body, paddingLeft: '18px' }}>{children}</ol>
          ),
          li: ({ children }) => <li style={{ marginBottom: '4px' }}>{children}</li>,
          hr: () => <hr style={{ border: 'none', borderTop: `1px solid ${lineColor}` }} />,
          // A link in a reading is not something this surface can honour —
          // there is nowhere to navigate to in a side panel — so it renders
          // as the text it wraps rather than as a dead blue word. It is also
          // the simplest way to make `[x](javascript:…)` inert.
          a: ({ children }) => <span style={{ color }}>{children}</span>,
          /**
           * An IMAGE IS A REQUEST, and this text is not ours (B4, safety).
           *
           * The narration is model output, and the model is reading text a
           * user pasted off somebody else's page. `![](https://tracker/x.png)`
           * in that text would make the extension page fetch an arbitrary
           * remote URL — React 19 even emits a `<link rel=preload>` for it —
           * which leaks that this user is reading this profile, to whoever
           * owns that host. There is no reading that needs a picture, so
           * there is no image element here at all: the alt text renders as
           * text, and the URL never reaches the document.
           */
          img: ({ alt }) =>
            alt ? (
              <span style={{ ...body, display: 'block', fontStyle: 'italic' }}>{String(alt)}</span>
            ) : null,
          // The table, in its OWN scroller. Without this a six-column koota
          // table widens the whole panel and the narration reads sideways.
          table: ({ children }) => (
            <div
              data-testid={testID ? `${testID}-table-scroller` : undefined}
              style={{ overflowX: 'auto', maxWidth: '100%', marginBottom: '10px' }}
            >
              <table style={{ borderCollapse: 'collapse' }}>{children}</table>
            </div>
          ),
          th: ({ children }) => (
            <th style={{ ...cell, fontWeight: 600, color: strongColor }}>{children}</th>
          ),
          td: ({ children }) => <td style={cell}>{children}</td>,
          // Fenced code in a narration is a DATA BLOCK that reached the wrong
          // place; the block registry draws the ones we know. Rendering it as
          // code would put raw JSON in front of a user (ASTRAL-20's defect),
          // so it draws nothing and says so once, in the console.
          code: ({ children }) => <CodeFallback>{children}</CodeFallback>,
        }}
      >
        {text}
      </Markdown>
    </div>
  );
}

let warnedAboutCode = false;

function CodeFallback({ children }: { children?: ReactNode }): null {
  if (!warnedAboutCode) {
    warnedAboutCode = true;
    console.warn(
      '[astral-dom/narration] a fenced or inline code span reached the narration ' +
        'renderer and was not drawn. If the engine now emits a block here, ' +
        'register it (docs/49 ASTRAL-20).',
      String(children ?? '').slice(0, 80),
    );
  }
  return null;
}

/** test seam — forget that the warning was emitted */
export function resetNarrationWarnings(): void {
  warnedAboutCode = false;
}
