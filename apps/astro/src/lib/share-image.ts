// Photograph a mounted view and hand it to the system share sheet.
//
// `react-native-view-shot` is already in the native build (the bug reporter
// uses it), so this ships by OTA. iOS shares the image FILE through React
// Native's own `Share` (`url` takes a file URI there). Android's `Share` has
// no file path and `expo-sharing` is not in this build, so Android sends the
// words — said here rather than discovered: the card's message carries the
// same verdict and the same hook.
import type { RefObject } from 'react';
import { Platform, Share, type View } from 'react-native';

export type ShareOutcome = 'shared' | 'dismissed' | 'text_only' | 'failed';

export async function shareView(
  ref: RefObject<View | null>, message: string,
): Promise<ShareOutcome> {
  try {
    if (Platform.OS !== 'ios') {
      const r = await Share.share({ message });
      return r.action === Share.dismissedAction ? 'dismissed' : 'text_only';
    }
    const vs = await import('react-native-view-shot');
    if (!ref.current || !vs.captureRef) return 'failed';
    const uri = await vs.captureRef(ref, { format: 'jpg', quality: 0.92, result: 'tmpfile' });
    const r = await Share.share({ url: uri, message });
    return r.action === Share.dismissedAction ? 'dismissed' : 'shared';
  } catch (e: unknown) {
    console.warn('[share]', String((e as Error)?.message ?? e));
    return 'failed';
  }
}
