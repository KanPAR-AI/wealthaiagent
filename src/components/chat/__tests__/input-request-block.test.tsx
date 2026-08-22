/**
 * docs/49 ASTRAL-83/89/90 on the web surface — the ask reaching a bubble, the
 * answer staying readable in the transcript, and the prose path surviving a
 * client that cannot draw the block.
 *
 * The react-markdown stand-in is the same one `block-registry.test.tsx`
 * documents at length: the real parser is ESM-only and this project's jest
 * config does not transform it. What is proven here is that `response.tsx`
 * routes a fenced block through the registry and what happens on each side of
 * that; what is NOT proven is react-markdown's own fence handling, which is
 * unchanged framework behaviour covered by the Playwright specs.
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

import { fireEvent, render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { inputRequestPayload } from '@wealthai/astral/fixtures';
import { buildInputResponseMessage, parseInputRequest, stripInputResponse } from '@wealthai/astral';

import { Response } from '@/components/chat/response';
import { responseBlockRegistry } from '@/components/chat/block-registry';

const PROSE =
  'One last thing — do you know your **birth time**? Even approximate helps. ' +
  "If you don't know it, just say so and I'll still cast the chart.";

function askMarkdown(type = 'input_request') {
  // The fence language always equals the body's own `type` — that is the
  // backend's convention and the only shape `readDataBlock` treats as data.
  // Passing a DIFFERENT `type` is how this file simulates a client build that
  // has no renderer for the block.
  const payload = { ...inputRequestPayload, type };
  return `${PROSE}\n\n\`\`\`${type}\n${JSON.stringify(payload)}\n\`\`\`\n\n`;
}

function renderAsk(markdown: string) {
  return render(
    <MemoryRouter>
      <Response>{markdown}</Response>
    </MemoryRouter>,
  );
}

describe('ASTRAL-83 — the ask arrives as a widget, not as a fence', () => {
  it('registers the type', () => {
    expect(responseBlockRegistry.has('input_request')).toBe(true);
  });

  it('renders the picker and never the payload', () => {
    const { getByTestId, container } = renderAsk(askMarkdown());
    expect(getByTestId('input-request')).toBeInTheDocument();
    expect(getByTestId('input-field-tob')).toHaveAttribute('type', 'time');
    expect(container.textContent).not.toContain('input_request');
    expect(container.textContent).not.toContain('"fields"');
  });

  it('keeps the prose above it — the block is an addition, not a replacement', () => {
    const { container } = renderAsk(askMarkdown());
    expect(container.textContent).toContain('do you know your');
  });

  it('sends the answer on the existing quick-reply channel', () => {
    const seen: string[] = [];
    const handler = (e: Event) => seen.push((e as CustomEvent).detail?.text);
    window.addEventListener('chat-quick-reply', handler);
    try {
      const { getByTestId } = renderAsk(askMarkdown());
      fireEvent.change(getByTestId('input-field-tob'), { target: { value: '00:20' } });
      fireEvent.click(getByTestId('input-request-next'));
      fireEvent.click(getByTestId('input-request-next'));
      expect(seen).toHaveLength(1);
      expect(seen[0]).toContain('```input_response');
      expect(JSON.parse(/```input_response\n([\s\S]*?)```/.exec(seen[0])![1]).values).toEqual({
        tob: '00:20',
      });
    } finally {
      window.removeEventListener('chat-quick-reply', handler);
    }
  });
});

describe('ASTRAL-90 — with the block renderer switched off, the prose still carries', () => {
  it('a client that cannot draw the block still shows an answerable question', () => {
    // A build that predates PH-11: the fence type is unknown to its registry.
    const { container, queryByTestId } = renderAsk(askMarkdown('input_request_v2'));
    expect(queryByTestId('input-request')).toBeNull();
    expect(container.textContent).toContain('do you know your');
    // ...and it is not shown the JSON instead.
    expect(container.textContent).not.toContain('"fields"');
    expect(container.textContent).not.toContain('birth_time_confidence');
  });

  it('an unparseable payload renders nothing rather than raw JSON', () => {
    const { container, queryByTestId } = renderAsk(
      `${PROSE}\n\n\`\`\`input_request\n{"type":"input_request","fields":[]}\n\`\`\``,
    );
    expect(queryByTestId('input-request')).toBeNull();
    expect(container.textContent).not.toContain('{');
  });
});

describe('ASTRAL-89 — the echo survives in the transcript, the fence does not', () => {
  it('what a user bubble shows is the sentence, not the payload', () => {
    // This is what `chat-bubbles.tsx` renders for a user turn: the stored
    // content passed through `stripInputResponse`. On a history reload the
    // stored content is all there is, so the echo IS the record of what they
    // answered — readable, and correctable by typing.
    const request = parseInputRequest(inputRequestPayload)!;
    const stored = buildInputResponseMessage(request, {
      tob: '00:20',
      birth_time_confidence: 'exact',
    });
    const shown = stripInputResponse(stored);
    expect(shown).toBe('Birth time: 12:20 am · How exact is that time?: Exact — off a record or a clock');
    expect(shown).not.toContain('```');
    expect(shown).not.toContain('{');
  });
});

describe('ASTRAL-89 — and the bubble itself actually strips it', () => {
  it('renders the echo and no fence for a real user message', async () => {
    // Renders the SHIPPED bubble, not the helper: the property is that
    // `chat-bubbles.tsx` calls `stripInputResponse` on a user turn, and
    // asserting the helper alone would pass on a bubble that never calls it.
    const { ChatBubble } = await import('@/components/chat/chat-bubbles');
    const request = parseInputRequest(inputRequestPayload)!;
    const stored = buildInputResponseMessage(request, { tob: '00:20' });
    const { container } = render(
      <MemoryRouter>
        <ChatBubble
          message={{ id: 'm1', sender: 'user', message: stored } as never}
          currentUser={undefined}
          actionIcons={[]}
          onFileClick={() => undefined}
        />
      </MemoryRouter>,
    );
    expect(container.textContent).toContain('Birth time: 12:20 am');
    expect(container.textContent).not.toContain('input_response');
    expect(container.textContent).not.toContain('{');
  });
});
