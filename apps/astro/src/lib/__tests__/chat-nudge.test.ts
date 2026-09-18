import { chatNudge, NUDGE_AFTER, NUDGE_AGAIN_EVERY, topicsIn } from '../chat-nudge';

const user = (t = 'q') => ({ sender: 'user', message: t });
const bot = (t = 'a') => ({ sender: 'bot', message: t });
const chat = (n: number, extra: { sender: string; message: string }[] = []) =>
  [...extra, ...Array.from({ length: n - extra.length }, (_, i) => (i % 2 ? bot() : user()))];

const CHART = bot('Casting…\n\n```natal_chart\n{"type":"natal_chart"}\n```\n');
const MATCH = bot('```match_report\n{"type":"match_report"}\n```');
const SELF = bot('ok\n```reading_subject\n{"type":"reading_subject","mode":"self","person_id":null}\n```');
const ROHAN = bot('ok\n```reading_subject\n{"type":"reading_subject","mode":"person","person_id":"p_rohan"}\n```');

describe('when a fresh reading is suggested (owner, 2026-09-18)', () => {
  it('never at or under thirty messages, however mixed', () => {
    expect(chatNudge(chat(NUDGE_AFTER, [CHART, MATCH]), null)).toBeNull();
  });

  it('past thirty, a mixed chat is told it is mixed', () => {
    const n = chatNudge(chat(NUDGE_AFTER + 1, [CHART, MATCH]), null)!;
    expect(n.reason).toBe('mixed');
    expect(n.topics).toEqual(['chart', 'match']);
    expect(n.body).toContain('stays saved');
  });

  it('past thirty, a single-topic chat is only told it is long', () => {
    const n = chatNudge(chat(NUDGE_AFTER + 5, [CHART]), null)!;
    expect(n.reason).toBe('long');
    expect(n.title).toBe('This reading is getting long');
  });

  it('"Keep going" buys twenty quiet messages, then it asks once more', () => {
    const at = NUDGE_AFTER + 1;
    expect(chatNudge(chat(at + NUDGE_AGAIN_EVERY - 1), at)).toBeNull();
    expect(chatNudge(chat(at + NUDGE_AGAIN_EVERY), at)).not.toBeNull();
  });
});

describe('a resumed chat loads one page, so the server total counts', () => {
  it('twenty bubbles in hand, sixty-two on the server: nudged', () => {
    const n = chatNudge(chat(20, [CHART]), null, 62)!;
    expect(n.count).toBe(62);
  });
  it('no total known: the bubbles in hand decide', () => {
    expect(chatNudge(chat(20), null, null)).toBeNull();
  });
});

describe('what counts as mixed', () => {
  it('the typed blocks the ENGINE replied with, never the user’s words', () => {
    expect(topicsIn([user('```match_report\n{}\n``` and my palm and a muhurta')])).toEqual([]);
    expect(topicsIn([CHART, MATCH])).toEqual(['chart', 'match']);
  });
  it('two palm blocks are one topic', () => {
    expect(topicsIn([bot('```palm_analysis\n{}\n```'), bot('```palm_predictions\n{}\n```')])).toEqual(['palm']);
  });
  it('a change of reading subject is a topic of its own', () => {
    expect(topicsIn([SELF, SELF])).toEqual([]);
    expect(topicsIn([SELF, ROHAN])).toEqual(['people']);
  });
  it('a malformed subject block is ignored', () => {
    expect(topicsIn([bot('```reading_subject\n{not json}\n```')])).toEqual([]);
  });
});
