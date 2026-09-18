// Photograph a mounted view and hand it to the system share sheet.
//
// `react-native-view-shot` is already in the native build (the bug reporter
// uses it), so this ships by OTA. iOS shares the image FILE through React
// Native's own `Share` (`url` takes a file URI there). Android's `Share` has
// no file path: from build 14 it goes through `expo-sharing`; on an older
// binary Android sends the words, which carry the same verdict and hook.
import type { RefObject } from 'react';
import { Platform, Share, type View } from 'react-native';
import { requireOptionalNativeModule } from 'expo-modules-core';

export type ShareOutcome = 'shared' | 'dismissed' | 'text_only' | 'failed';

export async function shareView(
  ref: RefObject<View | null>, message: string,
): Promise<ShareOutcome> {
  try {
    if (Platform.OS !== 'ios') {
      // Build 14 carries expo-sharing; builds 12/13 do not (same runtime, so
      // probe the native module before requiring the package).
      const sharing = requireOptionalNativeModule('ExpoSharing')
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        ? (require('expo-sharing') as typeof import('expo-sharing')) : null;
      const vsA = sharing ? await import('react-native-view-shot') : null;
      if (sharing && vsA?.captureRef && ref.current) {
        const file = await vsA.captureRef(ref, { format: 'jpg', quality: 0.92, result: 'tmpfile' });
        await sharing.shareAsync(file.startsWith('file://') ? file : `file://${file}`,
          { mimeType: 'image/jpeg', dialogTitle: message });
        return 'shared';
      }
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
