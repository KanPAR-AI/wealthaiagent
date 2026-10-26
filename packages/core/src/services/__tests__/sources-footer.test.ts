import {
  formatMoment,
  hasSourcesWidget,
  hideFooterWhenGallery,
  sourceCardsOf,
  stripSourcesFooter,
  verseLabel,
} from '../sources-footer';

const ANSWER = `[Using gita_ch2_discourse agent]

Swamiji explains that sadhana must be done oneself.

---
**Sources:**
- [साधना स्वयं करनी होती है](https://www.youtube.com/watch?v=fTcq8NonOA4&t=124)
- [खन्ना जी महाराज और राम नाम](https://www.youtube.com/watch?v=JkrWH0HK8qE&t=3944)

*This agent summarises Swami Anubhavananda's discourses; consult the original text.*`;

const GALLERY = {
  id: 'sources-2',
  type: 'widget_sources',
  data: {
    items: [
      { title: 'साधना स्वयं करनी होती है', url: 'https://www.youtube.com/watch?v=fTcq8NonOA4&t=124', video_id: 'fTcq8NonOA4', t: 124, chapter: '6', verse: '5', kind: 'unit' },
      { title: 'खन्ना जी महाराज और राम नाम', url: 'https://www.youtube.com/watch?v=JkrWH0HK8qE&t=3944', t: 3944, chapter: '18', verse: null, kind: 'story' },
    ],
  },
};

describe('stripSourcesFooter', () => {
  it('removes the list and keeps the prose and the disclaimer', () => {
    const out = stripSourcesFooter(ANSWER);
    expect(out).toContain('sadhana must be done oneself.');
    expect(out).toContain('*This agent summarises');
    expect(out).not.toContain('**Sources:**');
    expect(out).not.toContain('JkrWH0HK8qE');
  });
  it('leaves text without a footer untouched', () => {
    const t = 'Sources of strength are inside you.\n\n- a list\n- of things';
    expect(stripSourcesFooter(t)).toBe(t);
  });
  it('handles a footer at the very end, with no disclaimer', () => {
    const t = 'Answer.\n\n---\n**Sources:**\n- [a](https://youtu.be/abcdefg?t=5)\n';
    expect(stripSourcesFooter(t)).toBe('Answer.');
  });
});

describe('the gallery widget', () => {
  it('reads its cards from either payload shape', () => {
    expect(sourceCardsOf(GALLERY as any)).toHaveLength(2);
    expect(sourceCardsOf({ ...GALLERY, data: undefined, items: GALLERY.data.items } as any)).toHaveLength(2);
    expect(sourceCardsOf({ id: 'x', type: 'widget_table', data: {} } as any)).toEqual([]);
  });
  it('hides the footer only when the message carries the gallery', () => {
    const blocks = [
      { type: 'text' as const, content: ANSWER },
      { type: 'widget' as const, widget: GALLERY as any },
    ];
    expect(hasSourcesWidget(blocks)).toBe(true);
    const shown = hideFooterWhenGallery(blocks);
    expect((shown[0] as any).content).not.toContain('**Sources:**');
    expect(shown[1]).toBe(blocks[1]);
    const plain = [{ type: 'text' as const, content: ANSWER }];
    expect(hideFooterWhenGallery(plain)).toBe(plain);
    expect(hasSourcesWidget(undefined, [GALLERY as any])).toBe(true);
  });
  it('labels the verse and the moment', () => {
    expect(verseLabel({ title: 't', url: 'u', chapter: '6', verse: '5' })).toBe('6.5');
    expect(verseLabel({ title: 't', url: 'u', chapter: '18', verse: null })).toBe('Ch. 18');
    expect(verseLabel({ title: 't', url: 'u' })).toBe('');
    expect(formatMoment(124)).toBe('2:04');
    expect(formatMoment(3944)).toBe('1:05:44');
    expect(formatMoment(null)).toBe('');
  });
});
