import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.yourfinadvisor.app',
  appName: 'WealthWise AI',
  webDir: 'dist',
  ios: {
    contentInset: 'automatic',
    allowsLinkPreview: false,
    scrollEnabled: false, // Prevent WKWebView from scrolling the entire page
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      showSpinner: false,
      backgroundColor: '#ffffff',
      launchFadeOutDuration: 300,
    },
    StatusBar: {
      style: 'light',
      overlaysWebView: false, // Prevent status bar from overlapping content
    },
    Keyboard: {
      resize: 'native', // Use native resizing — 'ionic' only works with Ionic Framework
      resizeOnFullScreen: true,
      style: 'light',
    },
  },
  // Uncomment for live reload during development:
  // 1. Run `npm run dev` (starts Vite on port 5173)
  // 2. Uncomment the server block below
  // 3. Run `npx cap sync ios && npx cap open ios`
  // 4. Build & run in Xcode — app loads from Vite with hot reload
  // server: {
  //   url: 'http://192.168.68.67:5173',
  //   cleartext: true,
  // },
};

export default config;
