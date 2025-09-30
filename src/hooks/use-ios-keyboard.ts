// hooks/use-ios-keyboard.ts
import { useEffect, useState } from 'react';

export function useIOSKeyboard() {
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    // Check if we're on iOS Safari
    const isIOSSafari = /iPad|iPhone|iPod/.test(navigator.userAgent) && 
                       /Safari/.test(navigator.userAgent) && 
                       !/CriOS|FxiOS|OPiOS|mercury/.test(navigator.userAgent);

    if (!isIOSSafari) return;

    const initialViewportHeight = window.innerHeight;
    let currentViewportHeight = window.innerHeight;

    const handleResize = () => {
      currentViewportHeight = window.innerHeight;
      const heightDifference = initialViewportHeight - currentViewportHeight;
      
      // If viewport height decreased significantly, keyboard is likely open
      if (heightDifference > 150) {
        setIsKeyboardOpen(true);
        setKeyboardHeight(heightDifference);
      } else {
        setIsKeyboardOpen(false);
        setKeyboardHeight(0);
      }
    };

    const handleVisualViewportChange = () => {
      if (window.visualViewport) {
        const heightDifference = initialViewportHeight - window.visualViewport.height;
        if (heightDifference > 150) {
          setIsKeyboardOpen(true);
          setKeyboardHeight(heightDifference);
        } else {
          setIsKeyboardOpen(false);
          setKeyboardHeight(0);
        }
      }
    };

    // Use Visual Viewport API if available (better for iOS Safari)
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleVisualViewportChange);
    } else {
      window.addEventListener('resize', handleResize);
    }

    return () => {
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleVisualViewportChange);
      } else {
        window.removeEventListener('resize', handleResize);
      }
    };
  }, []);

  return { isKeyboardOpen, keyboardHeight };
}
