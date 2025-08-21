# Mobile App Environment Setup Guide

This guide explains how to configure environment variables for your mobile app to connect to the backend server.

## Quick Start

### Option 1: Production Setup (Recommended)
```bash
# For Unix/Linux/macOS
./setup-production.sh

# For Windows
setup-production.bat
```

### Option 2: Manual Setup
1. **Copy the environment template:**
   ```bash
   # For production (recommended)
   cp env.production .env
   
   # For local development
   cp env.example .env
   
   # For minimal setup
   cp env.minimal .env
   ```

2. **Edit the `.env` file** with your backend URL:
   ```bash
   # For Production (works everywhere)
   EXPO_PUBLIC_API_BASE_URL=https://chatbackend.yourfinadvisor.com
   
   # For Android Emulator (local development)
   EXPO_PUBLIC_API_BASE_URL=http://10.0.2.2:8080
   
   # For iOS Simulator (local development)
   EXPO_PUBLIC_API_BASE_URL=http://localhost:8080
   
   # For Physical Device (local development)
   EXPO_PUBLIC_API_BASE_URL=http://192.168.1.100:8080
   ```

3. **Restart your mobile app**

## Production vs Development Configuration

### 🚀 Production Configuration (Recommended)
- **Backend URL**: `https://chatbackend.yourfinadvisor.com`
- **Benefits**: 
  - Works on all platforms (Android, iOS, physical devices)
  - No localhost IP configuration needed
  - Secure HTTPS connection
  - Accessible from anywhere with internet
  - Consistent behavior across all devices
- **Setup**: Use `env.production` or run `setup-production.sh`/`setup-production.bat`

### 🛠️ Development Configuration
- **Backend URL**: `http://localhost:8080` or `http://10.0.2.2:8080`
- **Benefits**: 
  - Faster development iteration
  - Local debugging capabilities
  - Offline development possible
- **Setup**: Use `env.example` or `env.minimal`

## Environment Variable Priority

The app resolves API URLs in this order:

1. **`.env` file** - `EXPO_PUBLIC_API_BASE_URL` (highest priority)
2. **`.env` file** - `EXPO_PUBLIC_API_URL` 
3. **`app.json`** - `extra.apiUrl`
4. **Platform-specific defaults** (lowest priority)

## Platform-Specific Configuration

### Production (All Platforms)
```bash
EXPO_PUBLIC_API_BASE_URL=https://chatbackend.yourfinadvisor.com
```
- Works on Android, iOS, physical devices, and web
- No platform-specific configuration needed

### Android Emulator (Local Development)
```bash
EXPO_PUBLIC_API_BASE_URL=http://10.0.2.2:8080
```
- `10.0.2.2` is the special IP that Android emulator uses to access the host machine's localhost
- This is the most common setup for local development

### iOS Simulator (Local Development)
```bash
EXPO_PUBLIC_API_BASE_URL=http://localhost:8080
```
- iOS simulator can access localhost directly
- Works the same as web development

### Physical Device (Local Development)
```bash
EXPO_PUBLIC_API_BASE_URL=http://192.168.1.100:8080
```
- Replace `192.168.1.100` with your computer's actual local IP address
- Both device and computer must be on the same network

## Finding Your Local IP Address

### Windows
```cmd
ipconfig
```
Look for "IPv4 Address" under your active network adapter.

### macOS/Linux
```bash
ifconfig
# OR
ip addr show
```
Look for "inet" followed by your local IP (usually starts with 192.168.x.x or 10.0.x.x).

## Required Environment Variables

### Production Setup (Recommended)
```bash
# Backend API URL (without /api/v1 suffix)
EXPO_PUBLIC_API_BASE_URL=https://chatbackend.yourfinadvisor.com

# Test credentials (must match your production backend)
EXPO_PUBLIC_TEST_USERNAME=test_username
EXPO_PUBLIC_TEST_PASSWORD=kzjdbv
```

### Local Development Setup
```bash
# Backend API URL (without /api/v1 suffix)
EXPO_PUBLIC_API_BASE_URL=http://10.0.2.2:8080

# Test credentials (must match your local backend)
EXPO_PUBLIC_TEST_USERNAME=test_username
EXPO_PUBLIC_TEST_PASSWORD=kzjdbv
```

### Full Setup
See `env.example` for all available options including:
- Feature flags
- Performance settings
- External service configurations
- Development tools

## Quick Production Setup

### Using the Setup Scripts

#### Unix/Linux/macOS
```bash
cd wealthaiagent/apps/mobile
chmod +x setup-production.sh
./setup-production.sh
```

#### Windows
```cmd
cd wealthaiagent\apps\mobile
setup-production.bat
```

### Manual Production Setup
```bash
cd wealthaiagent/apps/mobile
cp env.production .env
```

## Troubleshooting

### App Shows Only Skeleton Loading
1. **Check backend is running:**
   ```bash
   # For production
   curl https://chatbackend.yourfinadvisor.com/api/v1/auth/token
   
   # For local development
   curl http://localhost:8080/api/v1/auth/token
   ```

2. **Verify environment variables:**
   - Ensure `.env` file exists in the mobile app root
   - Check variable names start with `EXPO_PUBLIC_`
   - Verify no typos in URLs

3. **Check console logs:**
   - Look for "Mobile Environment Config" logs
   - Check for API connection test results

### Network Connection Issues
1. **Production Backend:**
   - Ensure you have internet connection
   - Check if the production URL is accessible in a browser
   - Verify HTTPS certificate is valid

2. **Local Development:**
   - Ensure backend is running on port 8080
   - Try `http://10.0.2.2:8080` for Android emulator
   - Try `http://localhost:8080` for iOS simulator

3. **Physical Device:**
   - Check firewall settings
   - Ensure both devices are on same network
   - Try using computer's local IP address

### Environment Variables Not Loading
1. **Restart the app** after creating `.env` file
2. **Check file location** - `.env` must be in mobile app root directory
3. **Verify variable names** start with `EXPO_PUBLIC_`
4. **Clear Metro cache:**
   ```bash
   npx expo start --clear
   ```

## Testing Backend Connection

### Production Backend
```bash
curl https://chatbackend.yourfinadvisor.com/api/v1/auth/token
```

### Local Backend
Use the provided test script:
```bash
node test-backend-connection.js
```

This will test both localhost and Android emulator URLs.

## Production Configuration

For production, the recommended settings are:
```bash
EXPO_PUBLIC_API_BASE_URL=https://chatbackend.yourfinadvisor.com
EXPO_PUBLIC_APP_ENV=production
EXPO_PUBLIC_APP_DEBUG=false
EXPO_PUBLIC_ENABLE_ANALYTICS=true
EXPO_PUBLIC_ENABLE_DEBUG_LOGGING=false
```

## Security Notes

- **Never commit `.env` files** to version control
- **Use `.env.local`** for local-only overrides
- **Rotate credentials** regularly in production
- **Use HTTPS** in production environments
- **Production backend** is already HTTPS-secured

## File Structure

```
wealthaiagent/apps/mobile/
├── .env                    # Your actual environment variables (create this)
├── env.production          # Production configuration (recommended)
├── env.example             # Comprehensive example
├── env.minimal             # Minimal setup template
├── setup-production.sh     # Unix/Linux/macOS setup script
├── setup-production.bat    # Windows setup script
├── ENVIRONMENT_SETUP.md    # This guide
└── app.json                # Expo configuration
```

## Need Help?

If you're still experiencing issues:

1. **For Production**: Check if [https://chatbackend.yourfinadvisor.com](https://chatbackend.yourfinadvisor.com) is accessible
2. Check the console logs for detailed error messages
3. Verify your environment variables are properly formatted
4. Try the production configuration first (it's the most reliable)
5. Ensure your backend server is running (for local development)
