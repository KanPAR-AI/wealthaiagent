#!/bin/bash

echo "🚀 Setting up YourFinAdvisor Mobile App..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm first."
    exit 1
fi

# Check if Expo CLI is installed
if ! command -v expo &> /dev/null; then
    echo "📦 Installing Expo CLI..."
    npm install -g @expo/cli
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "📝 Creating .env file..."
    cat > .env << EOF
# API Configuration
EXPO_PUBLIC_API_URL=http://localhost:8080/api/v1

# Clerk Authentication (replace with your actual key)
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_your-test-key-here

# Development Settings
EXPO_PUBLIC_DEBUG=true
EOF
    echo "✅ Created .env file. Please update with your actual API URL and Clerk key."
else
    echo "✅ .env file already exists."
fi

# Check if backend is running
echo "🔍 Checking backend connection..."
if curl -s http://localhost:8080/api/v1/chats > /dev/null 2>&1; then
    echo "✅ Backend server is running."
else
    echo "⚠️  Backend server is not running on http://localhost:8080"
    echo "   Please start the backend server first:"
    echo "   cd ../../../chatservice && python -m uvicorn app:app --reload --port 8080"
fi

echo ""
echo "🎉 Setup complete!"
echo ""
echo "Next steps:"
echo "1. Update .env file with your actual API URL and Clerk key"
echo "2. Start the development server: npm start"
echo "3. Run on your preferred platform:"
echo "   - Web: npm run web"
echo "   - iOS: npm run ios"
echo "   - Android: npm run android"
echo ""
echo "For troubleshooting, see README.md"
