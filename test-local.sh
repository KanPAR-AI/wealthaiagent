#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${CYAN}╔════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║   WealthAI Agent - Local Development   ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════╝${NC}"
echo ""

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo -e "${RED}✗ npm is not installed. Please install Node.js and npm first.${NC}"
    echo -e "${BLUE}  Download from: https://nodejs.org/${NC}"
    exit 1
fi

# Check Node.js version and ensure LTS (22)
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
NODE_VERSION_FULL=$(node -v)
LTS_VERSION=22

if [ "$NODE_VERSION" -lt "$LTS_VERSION" ]; then
    echo -e "${YELLOW}⚠ Node.js 22 LTS is recommended. Current version: ${NODE_VERSION_FULL}${NC}"
    echo -e "${BLUE}📥 To install Node.js 22 LTS:${NC}"
    echo -e "${BLUE}   1. Download from: https://nodejs.org/${NC}"
    echo -e "${BLUE}   2. Or use nvm:${NC}"
    echo -e "${BLUE}      curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.3/install.sh | bash${NC}"
    echo -e "${BLUE}      nvm install --lts${NC}"
    echo -e "${BLUE}      nvm use --lts${NC}"
    echo -e "${YELLOW}⚠ Continuing with current version, but LTS is recommended${NC}"
else
    echo -e "${GREEN}✓ Node.js version: ${NODE_VERSION_FULL} (LTS or newer)${NC}"
fi

# Setup environment file if it doesn't exist
if [ ! -f ".env.local" ]; then
    echo -e "${YELLOW}📝 Setting up environment file...${NC}"
    if [ -f "config/env.example" ]; then
        cp config/env.example .env.local
        echo -e "${GREEN}✓ Created .env.local from template${NC}"
        echo -e "${BLUE}  You can edit .env.local to configure your settings${NC}"
    else
        echo -e "${YELLOW}⚠ No env.example found, creating basic .env.local${NC}"
        cat > .env.local << EOF
# Local Development Environment
VITE_API_BASE_URL=http://localhost:8080
VITE_APP_NAME=WealthAI Agent
VITE_APP_PORT=5173
VITE_ENABLE_DEBUG=true
VITE_BUILD_TARGET=development
EOF
        echo -e "${GREEN}✓ Created basic .env.local${NC}"
    fi
else
    echo -e "${GREEN}✓ Environment file already exists${NC}"
fi

# Clean install dependencies with latest versions
echo -e "\n${YELLOW}🧹 Cleaning existing dependencies...${NC}"
rm -rf node_modules package-lock.json

echo -e "${YELLOW}📦 Installing latest dependencies with --legacy-peer-deps...${NC}"
npm install --legacy-peer-deps

if [ $? -ne 0 ]; then
    echo -e "${RED}✗ Failed to install dependencies${NC}"
    echo -e "${YELLOW}  Try running: npm cache clean --force${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Dependencies installed successfully${NC}"

# Start development server
echo -e "\n${GREEN}🚀 Starting development server...${NC}"
echo -e "${BLUE}  URL: http://localhost:5173${NC}"
echo -e "${BLUE}  Press Ctrl+C to stop${NC}"
echo -e "${YELLOW}📝 Note: Make sure your backend service is running if needed${NC}\n"

# Start the development server
npm run dev

