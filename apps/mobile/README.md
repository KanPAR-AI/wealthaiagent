# YourFinAdvisor Mobile App

A React Native mobile application built with Expo for the YourFinAdvisor chat platform.

## Features

- Real-time chat with AI assistant
- File upload and preview
- Message history
- Authentication with Clerk
- Cross-platform (iOS, Android, Web)

## Prerequisites

- Node.js 18+ 
- npm or yarn
- Expo CLI (`npm install -g @expo/cli`)
- iOS Simulator (for iOS development)
- Android Studio (for Android development)

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Environment Configuration:**
   Create a `.env` file in the mobile app directory:
   ```env
   EXPO_PUBLIC_API_URL=http://localhost:8080/api/v1
   EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=your_clerk_key_here
   ```

3. **Start the development server:**
   ```bash
   npm start
   ```

4. **Run on different platforms:**
   - **Web:** `npm run web`
   - **iOS:** `npm run ios`
   - **Android:** `npm run android`

## API Integration

The mobile app connects to the YourFinAdvisor backend API for:
- Chat session management
- Message streaming
- File uploads
- Authentication

### API Endpoints Used:
- `POST /api/v1/chats` - Create new chat
- `GET /api/v1/chats/{id}` - Get chat history
- `POST /api/v1/chats/{id}/messages` - Send message
- `GET /api/v1/chats/{id}/stream` - Stream AI responses
- `POST /api/v1/auth/token` - Get JWT token

## Architecture

- **Components:** React Native components in `components/`
- **Hooks:** Custom hooks in `hooks/`
- **Services:** API integration in `services/`
- **Store:** State management with Zustand in `store/`
- **Types:** Shared types from `@wealthwise/types`

## Troubleshooting

### Metro Bundler Issues
If you encounter Metro bundler errors:
1. Clear Metro cache: `npx expo start --clear`
2. Reset project: `npm run reset-project`

### NativeWind Issues
If you see CSS-related errors:
1. Ensure `react-native-css-interop` is installed
2. Check babel configuration
3. Verify Tailwind config

### API Connection Issues
1. Ensure backend server is running
2. Check `EXPO_PUBLIC_API_URL` environment variable
3. Verify network connectivity

## Development

### Adding New Features
1. Create components in `components/`
2. Add hooks in `hooks/`
3. Update services in `services/`
4. Add types to shared packages if needed

### Testing
```bash
npm test
```

### Building for Production
```bash
npx expo build:android
npx expo build:ios
```

## Dependencies

Key dependencies:
- `expo-router` - Navigation
- `nativewind` - Styling
- `zustand` - State management
- `@clerk/clerk-react` - Authentication
- `@wealthwise/hooks` - Shared hooks
- `@wealthwise/types` - Shared types
