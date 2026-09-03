/**
 * The studio player's audio-language selector (docs/44 CORP-29).
 *
 * Three properties, pinned:
 *   1. No tracks → no selector: an undubbed asset renders today's player
 *      exactly.
 *   2. Tracks → a selector naming each language plus the original.
 *   3. Switching swaps the <video> source to the per-language MP4 while
 *      preserving currentTime and resuming playback (capture → swap →
 *      restore → resume), driven through loadedmetadata because setting
 *      `src` resets a media element's clock.
 */
import { fireEvent, render, screen } from '@testing-library/react';

import { VideoPlayer } from '../video-player';
import type { AssetMedia } from '@/services/corpus-video-service';

jest.mock('../filmstrip', () => ({
  FrameAt: () => null,
}));

const BASE: AssetMedia = {
  corpus_id: 'knee_timed',
  source: 'clip.mp4',
  duration_s: 100,
  stored: true,
  ticket: 'tkt',
  source_url: '/media/tkt/source',
  audio_tracks: [],
};

function renderPlayer(media: AssetMedia) {
  return render(
    <VideoPlayer media={media} segments={[]} duration={100} />,
  );
}

describe('VideoPlayer audio-language selector', () => {
  it('renders no selector when the asset has no dubbed tracks', () => {
    renderPlayer(BASE);
    expect(screen.queryByRole('group', { name: /audio language/i })).toBeNull();
  });

  it('renders the original plus each track when tracks exist', () => {
    renderPlayer({
      ...BASE,
      audio_tracks: [
        { lang: 'hi', label: 'हिन्दी', source_url: '/media/tkt/source_hi' },
      ],
    });
    const group = screen.getByRole('group', { name: /audio language/i });
    expect(group).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'English' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'हिन्दी' })).toBeInTheDocument();
  });

  it('defaults to the preferred language when the payload carries one', () => {
    const { container } = renderPlayer({
      ...BASE,
      preferred_lang: 'hi',
      audio_tracks: [
        { lang: 'hi', label: 'हिन्दी', source_url: '/media/tkt/source_hi' },
      ],
    });
    const video = container.querySelector('video') as HTMLVideoElement;
    expect(video.getAttribute('src')).toContain('source_hi');
    expect(
      screen.getByRole('button', { name: 'हिन्दी' }),
    ).toHaveAttribute('aria-pressed', 'true');
  });

  it('ignores a preference that names no existing track', () => {
    const { container } = renderPlayer({
      ...BASE,
      preferred_lang: 'ta',
      audio_tracks: [
        { lang: 'hi', label: 'हिन्दी', source_url: '/media/tkt/source_hi' },
      ],
    });
    const video = container.querySelector('video') as HTMLVideoElement;
    expect(video.getAttribute('src')).not.toContain('source_hi');
  });

  it('switching language swaps the source and preserves the position', () => {
    const { container } = renderPlayer({
      ...BASE,
      audio_tracks: [
        { lang: 'hi', label: 'हिन्दी', source_url: '/media/tkt/source_hi' },
      ],
    });
    const video = container.querySelector('video') as HTMLVideoElement;
    expect(video.getAttribute('src')).toContain('/media/tkt/source');
    expect(video.getAttribute('src')).not.toContain('source_hi');

    // jsdom's media element has a writable currentTime and fires no real
    // media events — drive the contract by hand.
    Object.defineProperty(video, 'paused', { value: false, writable: true });
    video.currentTime = 42;

    fireEvent.click(screen.getByRole('button', { name: 'हिन्दी' }));
    expect(video.getAttribute('src')).toContain('source_hi');

    // the swap resets the clock (as a real browser would)…
    video.currentTime = 0;
    const play = jest.fn().mockResolvedValue(undefined);
    (video as unknown as { play: () => Promise<void> }).play = play;
    fireEvent.loadedMetadata(video);

    // …and loadedmetadata restores it and resumes.
    expect(video.currentTime).toBe(42);
    expect(play).toHaveBeenCalled();

    // switching back returns to the original source, same contract
    fireEvent.click(screen.getByRole('button', { name: 'English' }));
    expect(video.getAttribute('src')).not.toContain('source_hi');
  });
});
