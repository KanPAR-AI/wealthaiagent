@echo off
echo 🚀 Setting up YourFinAdvisor Mobile App...

REM Check if Node.js is installed
node --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Node.js is not installed. Please install Node.js 18+ first.
    exit /b 1
)

REM Check if npm is installed
npm --version >nul 2>&1
if errorlevel 1 (
    echo ❌ npm is not installed. Please install npm first.
    exit /b 1
)

REM Check if Expo CLI is installed
expo --version >nul 2>&1
if errorlevel 1 (
    echo 📦 Installing Expo CLI...
    npm install -g @expo/cli
)

REM Install dependencies
echo 📦 Installing dependencies...
npm install

REM Create .env file if it doesn't exist
if not exist .env (
    echo 📝 Creating .env file...
    (
        echo # API Configuration
        echo EXPO_PUBLIC_API_URL=http://localhost:8080/api/v1
        echo.
        echo # Clerk Authentication ^(replace with your actual key^)
        echo EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_your-test-key-here
        echo.
        echo # Development Settings
        echo EXPO_PUBLIC_DEBUG=true
    ) > .env
    echo ✅ Created .env file. Please update with your actual API URL and Clerk key.
) else (
    echo ✅ .env file already exists.
)

REM Check if backend is running
echo 🔍 Checking backend connection...
curl -s http://localhost:8080/api/v1/chats >nul 2>&1
if errorlevel 1 (
    echo ⚠️  Backend server is not running on http://localhost:8080
    echo    Please start the backend server first:
    echo    cd ../../../chatservice ^&^& python -m uvicorn app:app --reload --port 8080
) else (
    echo ✅ Backend server is running.
)

echo.
echo 🎉 Setup complete!
echo.
echo Next steps:
echo 1. Update .env file with your actual API URL and Clerk key
echo 2. Start the development server: npm start
echo 3. Run on your preferred platform:
echo    - Web: npm run web
echo    - iOS: npm run ios
echo    - Android: npm run android
echo.
echo For troubleshooting, see README.md
pause
