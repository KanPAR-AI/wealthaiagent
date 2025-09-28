#!/bin/bash

# Local Deployment Script
# This script sets up and runs the application in local development mode

set -e

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   Local Development Deployment         ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo ""

# Check if .env.local exists
if [ ! -f ".env.local" ]; then
    echo -e "${YELLOW}⚠ .env.local not found. Creating from example...${NC}"
    if [ -f "config/env.example" ]; then
        cp config/env.example .env.local
        echo -e "${GREEN}✓ Created .env.local from config/env.example${NC}"
        echo -e "${YELLOW}  Please update .env.local with your actual values${NC}"
        exit 1
    else
        echo -e "${RED}✗ config/env.example not found!${NC}"
        exit 1
    fi
fi

# Load environment variables
set -a
source .env.local
set +a

# Validate required environment variables
if [ -z "$VITE_CLERK_PUBLISHABLE_KEY" ] || [ "$VITE_CLERK_PUBLISHABLE_KEY" = "your_clerk_publishable_key_here" ]; then
    echo -e "${RED}✗ VITE_CLERK_PUBLISHABLE_KEY not configured in .env.local${NC}"
    echo -e "${YELLOW}  Please update .env.local with your Clerk publishable key${NC}"
    exit 1
fi

# Display configuration
echo -e "${GREEN}Configuration:${NC}"
echo -e "  API URL: ${VITE_API_BASE_URL:-http://localhost:8080}"
echo -e "  API Version: ${VITE_API_VERSION:-v1}"
echo -e "  App Name: ${VITE_APP_NAME:-WealthAI Agent}"
echo -e "  Debug Mode: ${VITE_ENABLE_DEBUG:-true}"
echo ""

# Install dependencies
echo -e "${YELLOW}📦 Installing dependencies...${NC}"
npm install

# Run tests
echo -e "${YELLOW}🧪 Running tests...${NC}"
npm run test:ci || {
    echo -e "${RED}✗ Tests failed!${NC}"
    echo -e "${YELLOW}  Run with --skip-tests to bypass${NC}"
    exit 1
}

# Start development server
echo -e "${GREEN}🚀 Starting development server...${NC}"
echo -e "${BLUE}  URL: http://localhost:${VITE_APP_PORT:-5173}${NC}"
echo -e "${BLUE}  API: ${VITE_API_BASE_URL:-http://localhost:8080}${NC}"
echo ""

npm run dev 