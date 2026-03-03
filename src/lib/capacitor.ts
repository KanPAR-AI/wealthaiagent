import { Capacitor } from '@capacitor/core';

export const isNativePlatform = Capacitor.isNativePlatform();

/**
 * Initialize Capacitor plugins when running as a native app.
 * Call once at app startup.
 */
export async function initCapacitor(): Promise<void> {
  if (!isNativePlatform) return;

  const [{ StatusBar, Style }, { Keyboard }] = await Promise.all([
    import('@capacitor/status-bar'),
    import('@capacitor/keyboard'),
  ]);

  // Dark status bar text for light backgrounds
  StatusBar.setStyle({ style: Style.Light });

  // Keyboard: scroll to focused input and resize viewport
  Keyboard.setAccessoryBarVisible({ isVisible: true });
}
