# PWA Setup Guide for WealthWise AI

## Overview
Your WealthWise AI application is now configured as a Progressive Web App (PWA) with the following features:

- ✅ **Install Prompt**: Smart install popup that appears after 3 seconds
- ✅ **Offline Support**: Service worker with caching for offline functionality
- ✅ **Auto Updates**: Automatic service worker updates with user notification
- ✅ **Mobile Optimized**: iOS and Android installation support
- ✅ **App-like Experience**: Standalone display mode when installed

## Features Added

### 1. PWA Manifest (`/public/manifest.json`)
- App name, description, and theme colors
- Multiple icon sizes for different devices
- Standalone display mode for app-like experience
- Proper categorization for app stores

### 2. Service Worker (`/public/sw.js`)
- Offline caching of static assets
- API response caching with NetworkFirst strategy
- Push notification support (ready for future use)
- Automatic cache management and updates

### 3. Install Component (`/src/components/PWAInstall.tsx`)
- Smart install prompt that detects device capabilities
- iOS-specific instructions for Safari users
- Update notifications when new versions are available
- Dismissal tracking to avoid spam (7-day cooldown)
- Online/offline status indicators

### 4. PWA Utilities (`/src/utils/pwa.ts`)
- Service worker registration helpers
- Offline/online status detection
- Notification permission management
- PWA installation detection

### 5. Vite PWA Plugin Configuration
- Automatic service worker generation and registration
- Workbox integration for advanced caching strategies
- Runtime caching for API calls
- Automatic manifest generation

## How to Generate Icons

1. Open `/public/generate-icons.html` in your browser
2. Click "Download All Icons" to generate all required PWA icons
3. The icons will be automatically downloaded to your Downloads folder
4. Move the downloaded icons to `/public/icons/` directory

**Required icon sizes:**
- 16x16, 32x32, 72x72, 96x96, 128x128, 144x144, 152x152, 192x192, 384x384, 512x512

## Installation Experience

### Desktop (Chrome, Edge, Firefox)
- Install prompt appears after 3 seconds
- One-click installation to desktop
- App opens in standalone window

### Mobile (Android)
- Install prompt appears after 3 seconds
- One-click installation to home screen
- Full-screen app experience

### Mobile (iOS/Safari)
- Custom instructions shown for manual installation
- "Add to Home Screen" guidance
- Native iOS app-like experience

## Testing the PWA

### Local Testing
1. Run `npm run build` to create production build
2. Serve the build folder with a local server:
   ```bash
   npx serve dist
   ```
3. Open in Chrome/Edge and check "Add to Home Screen" option
4. Test offline functionality by going offline in DevTools

### Production Testing
1. Deploy to your hosting platform
2. Ensure HTTPS is enabled (required for PWA)
3. Test installation on various devices
4. Verify offline functionality

## PWA Audit

Use Chrome DevTools to audit your PWA:
1. Open DevTools (F12)
2. Go to "Lighthouse" tab
3. Select "Progressive Web App" audit
4. Run audit to check PWA compliance

## Features Available

### Offline Support
- Static assets cached for offline viewing
- API responses cached with smart invalidation
- Offline page component ready for customization

### Update Management
- Automatic detection of new versions
- User-friendly update prompts
- Seamless updates without data loss

### Installation Tracking
- Prevents spam by tracking dismissals
- 7-day cooldown after dismissal
- Smart detection of already installed state

## Customization

### Styling
- Install prompt uses Tailwind CSS classes
- Easily customizable colors and layout
- Dark mode support included

### Behavior
- Adjust install prompt delay in `PWAInstall.tsx`
- Modify dismissal cooldown period
- Customize update notification timing

### Caching
- Configure cache strategies in `vite.config.ts`
- Add custom runtime caching rules
- Modify cache expiration policies

## Troubleshooting

### Install Prompt Not Showing
- Ensure HTTPS is enabled
- Check browser console for errors
- Verify manifest.json is accessible
- Clear browser cache and try again

### Offline Functionality Issues
- Check service worker registration in DevTools
- Verify cache storage in Application tab
- Test with network throttling in DevTools

### Update Notifications Not Working
- Check service worker update cycle
- Verify workbox configuration
- Test with forced cache updates

## Next Steps

1. **Generate Icons**: Use the provided HTML tool to create all required icons
2. **Test Installation**: Deploy and test on various devices
3. **Customize Branding**: Update colors and icons to match your brand
4. **Add Push Notifications**: Implement notification features if needed
5. **Monitor Performance**: Use Lighthouse to optimize PWA score

Your WealthWise AI app is now a fully functional PWA! 🎉
