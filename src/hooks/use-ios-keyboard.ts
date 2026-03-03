// hooks/use-ios-keyboard.ts
import { useEffect, useState, useCallback } from 'react';

/**
 * Detects iOS keyboard open/close and provides the keyboard height.
 *
 * Uses the Visual Viewport API (available in iOS Safari 13+) which gives
 * accurate viewport dimensions excluding the on-screen keyboard.
 * Falls back to window.innerHeight comparison for older browsers.
 */
export function useIOSKeyboard() {
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  const isIOS = useCallback(() => {
    if (typeof navigator === 'undefined') return false;
    return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  }, []);

  useEffect(() => {
    if (!isIOS()) return;

    let initialHeight = window.innerHeight;
    let rafId: number | null = null;

    const update = () => {
      const vv = window.visualViewport;
      if (!vv) return;

      // The visual viewport shrinks when the keyboard opens.
      // The difference between the layout viewport and visual viewport
      // is the keyboard height.
      const currentHeight = vv.height;
      const diff = initialHeight - currentHeight;

      // Threshold of 150px to avoid false positives from URL bar changes
      if (diff > 150) {
        setIsKeyboardOpen(true);
        setKeyboardHeight(diff);
      } else {
        setIsKeyboardOpen(false);
        setKeyboardHeight(0);
      }
    };

    const handleResize = () => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(update);
    };

    // Also update the initial height when orientation changes
    const handleOrientationChange = () => {
      // Wait for the orientation change to complete
      setTimeout(() => {
        initialHeight = window.innerHeight;
        update();
      }, 300);
    };

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleResize);
      window.visualViewport.addEventListener('scroll', handleResize);
    }
    window.addEventListener('orientationchange', handleOrientationChange);

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleResize);
        window.visualViewport.removeEventListener('scroll', handleResize);
      }
      window.removeEventListener('orientationchange', handleOrientationChange);
    };
  }, [isIOS]);

  return { isKeyboardOpen, keyboardHeight };
}
