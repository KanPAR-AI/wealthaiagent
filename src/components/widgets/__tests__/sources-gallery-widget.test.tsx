import { fireEvent, render, screen } from '@testing-library/react';
import { SourcesGalleryWidget } from '../sources-gallery-widget';

const widget = {
  id: 'sources-3',
  type: 'widget_sources',
  data: {
    items: [
      { title: 'साधना स्वयं करनी होती है', url: 'https://www.youtube.com/watch?v=fTcq8NonOA4&t=124', video_id: 'fTcq8NonOA4', t: 124, chapter: '6', verse: '5', kind: 'unit' },
      { title: 'खन्ना जी महाराज और राम नाम', url: 'https://www.youtube.com/watch?v=JkrWH0HK8qE&t=3944', video_id: 'JkrWH0HK8qE', t: 3944, chapter: '18', verse: null, kind: 'story' },
      { title: 'A PDF source', url: 'https://example.com/doc.pdf', video_id: null, t: null, chapter: null, verse: null, kind: 'pdf' },
    ],
  },
} as any;

describe('SourcesGalleryWidget', () => {
  it('renders one card per source with the verse and the moment', () => {
    render(<SourcesGalleryWidget widget={widget} />);
    expect(screen.getAllByRole('button')).toHaveLength(3);
    expect(screen.getAllByText(/6\.5/).length).toBeGreaterThan(0);
    expect(screen.getByText('2:04')).toBeInTheDocument();
    expect(screen.getAllByText(/Ch\. 18/).length).toBeGreaterThan(0);
    expect(screen.getByText('1:05:44')).toBeInTheDocument();
    expect(document.querySelector('iframe')).toBeNull();
  });

  it('opens one player at the cited moment and swaps it on another tap', () => {
    render(<SourcesGalleryWidget widget={widget} />);
    fireEvent.click(screen.getByTitle('साधना स्वयं करनी होती है'));
    let frame = document.querySelector('iframe')!;
    expect(frame.getAttribute('src')).toContain('fTcq8NonOA4');
    expect(frame.getAttribute('src')).toContain('start=124');
    fireEvent.click(screen.getByTitle('खन्ना जी महाराज और राम नाम'));
    expect(document.querySelectorAll('iframe')).toHaveLength(1);
    frame = document.querySelector('iframe')!;
    expect(frame.getAttribute('src')).toContain('JkrWH0HK8qE');
    fireEvent.click(screen.getByLabelText('Close player'));
    expect(document.querySelector('iframe')).toBeNull();
  });

  it('renders nothing for a widget without sources', () => {
    const { container } = render(<SourcesGalleryWidget widget={{ id: 'x', type: 'widget_sources', data: { items: [] } } as any} />);
    expect(container.firstChild).toBeNull();
  });
});
