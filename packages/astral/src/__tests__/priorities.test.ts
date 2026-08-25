/**
 * docs/49 PH-19 — the `multi` kind on the wire, and the emphasis beside the
 * artifact (ASTRAL-152, ASTRAL-148/149/150, F42).
 *
 * Both payloads are CAPTURED from the engine (`fixtures/payloads.ts`), so a
 * client that stops matching what the engine sends fails here rather than on
 * somebody's phone.
 *
 * The property that matters most is a negative one: `emphasis` may carry an
 * ORDER and SENTENCES, and it may never carry a number. A client that read a
 * total out of it would be the place ASTRAL-149 breaks quietly, since nothing
 * on the server would have changed.
 */

import { matchEmphasisPayload, prioritiesAskPayload } from '../fixtures/payloads';
import {
  buildInputResponseMessage,
  echoFor,
  parseInputRequest,
  type InputRequestPayload,
} from '../input-request';
import { parseMatchReport, type MatchReportPayload } from '../payloads';
import { kootaRows } from '../view/match';

const ask = parseInputRequest(prioritiesAskPayload) as InputRequestPayload;

const answerOf = (message: string) =>
  JSON.parse(/```input_response\n([\s\S]*?)```/.exec(message)![1]);

describe('ASTRAL-152 — the `multi` kind', () => {
  it('parses the engine\'s ask, with its cardinality', () => {
    expect(ask).not.toBeNull();
    expect(ask.ask).toBe('partner_priorities');
    const ranked = ask.fields[0];
    expect(ranked.kind).toBe('multi');
    expect(ranked.min).toBe(0);
    expect(ranked.max).toBe(3);
    expect(ranked.ordered).toBe(true);
    expect(ranked.options.length).toBe(8);
  });

  it('keeps the two tiers apart, and neither is required', () => {
    const [ranked, interests, note] = ask.fields;
    expect(ranked.key).toBe('priorities');
    expect(interests.key).toBe('priority_interests');
    expect(interests.ordered).toBe(false);
    expect(note.kind).toBe('text');
    expect(ask.fields.every((f) => f.required === false)).toBe(true);
  });

  it('refuses a `multi` with no options — a dead card is the failure mode', () => {
    expect(
      parseInputRequest({
        type: 'input_request',
        ask: 'x',
        fields: [{ key: 'priorities', kind: 'multi', label: 'x', options: [] }],
      }),
    ).toBeNull();
  });

  it('defaults an unstated max to every option, never to one', () => {
    const parsed = parseInputRequest({
      type: 'input_request',
      ask: 'x',
      fields: [
        {
          key: 'priorities',
          kind: 'multi',
          label: 'x',
          options: [
            { value: 'a', label: 'A' },
            { value: 'b', label: 'B' },
          ],
        },
      ],
    }) as InputRequestPayload;
    expect(parsed.fields[0].max).toBe(2);
  });

  it('carries the picks as an ORDERED LIST of values, never as a sentence', () => {
    const message = buildInputResponseMessage(ask, {
      priorities: ['health_progeny', 'temperament'],
      priority_interests: ['career'],
      priority_note: 'kind to my mother',
    });
    expect(answerOf(message).values).toEqual({
      priorities: ['health_progeny', 'temperament'],
      priority_interests: ['career'],
      priority_note: 'kind to my mother',
    });
  });

  it('echoes the LABELS in the order picked, for the human, not the engine', () => {
    const echo = echoFor(ask, {
      priorities: ['health_progeny', 'temperament'],
      priority_interests: ['career', 'wealth'],
    });
    expect(echo).toContain('Health and children, then Temperament and emotional fit');
    // the unordered tier is a list, not a ranking
    expect(echo).toContain('Career and work, Money and wealth');
  });

  it('sends an empty list as an answer — that is how a set is cleared', () => {
    const message = buildInputResponseMessage(ask, { priorities: [] });
    expect(answerOf(message).values).toEqual({ priorities: [] });
    expect(echoFor(ask, { priorities: [] })).toContain('none');
  });

  it('is still the fence that carries everything — delete it and nothing survives', () => {
    const message = buildInputResponseMessage(ask, {
      priorities: ['chemistry', 'values'],
    });
    const withoutFence = message.replace(/```input_response[\s\S]*?```/, '').trim();
    expect(withoutFence).not.toContain('chemistry');
    expect(withoutFence).not.toContain('values');
  });
});

describe('ASTRAL-148/149/150 — the emphasis is a sibling, not a score', () => {
  const report = parseMatchReport(matchEmphasisPayload) as MatchReportPayload;

  it('parses beside the artifact', () => {
    expect(report).not.toBeNull();
    expect(report.emphasis?.leading).toEqual(['Nadi', 'Gana']);
    expect(report.emphasis?.rule).toContain('Nadi');
  });

  it('carries no number of its own', () => {
    const asJson = JSON.stringify(report.emphasis);
    expect(asJson).not.toMatch(/"(points|total|score|max|band|verdict)"/);
  });

  it('reorders the rows and changes not one fraction', () => {
    const withEmphasis = kootaRows(report);
    const bare = kootaRows({ ...report, emphasis: undefined });
    expect(withEmphasis.map((k) => k.name)).not.toEqual(bare.map((k) => k.name));
    expect(withEmphasis[0].name).toBe('Nadi');
    const fractionOf = (rows: ReturnType<typeof kootaRows>) =>
      Object.fromEntries(rows.map((r) => [r.name, r.fraction]));
    expect(fractionOf(withEmphasis)).toEqual(fractionOf(bare));
    expect(withEmphasis.length).toBe(bare.length);
  });

  it('leaves every headline number untouched', () => {
    const bare = parseMatchReport({
      ...matchEmphasisPayload,
      emphasis: undefined,
    }) as MatchReportPayload;
    const numbers = (r: MatchReportPayload) => ({
      total: r.total,
      max_total: r.max_total,
      firm_total: r.firm_total,
      firm_max: r.firm_max,
      verdict: r.verdict,
      doshas: r.doshas,
      kootas: r.kootas,
    });
    expect(numbers(report)).toEqual(numbers(bare));
  });

  it('states what gun milan does not score, without moving anything', () => {
    expect(report.emphasis?.unscored[0].key).toBe('career');
    expect(report.emphasis?.unscored[0].sentence).toContain('does not score');
  });

  it('ignores an emphasis it cannot vouch for rather than half-applying it', () => {
    const broken = parseMatchReport({
      ...matchEmphasisPayload,
      emphasis: { koota_order: [], rule: 'Ordered by nothing' },
    }) as MatchReportPayload;
    expect(broken.emphasis).toBeUndefined();
    expect(kootaRows(broken).map((k) => k.name)).toEqual(
      kootaRows({ ...broken, emphasis: undefined }).map((k) => k.name),
    );
  });
});
