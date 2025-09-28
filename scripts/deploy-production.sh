#!/bin/bash

# Production Deployment Script
# This script builds and prepares the application for production deployment

set -e

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${CYAN}╔════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║   Production Deployment                ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════╝${NC}"
echo ""

# Check if .env.production exists
if [ ! -f ".env.production" ]; then
    echo -e "${RED}✗ .env.production not found!${NC}"
    echo -e "${YELLOW}  Create .env.production from config/env.production.example${NC}"
    exit 1
fi

# Load environment variables
set -a
source .env.production
set +a

# Validate required environment variables
if [ -z "$VITE_CLERK_PUBLISHABLE_KEY" ] || [ "$VITE_CLERK_PUBLISHABLE_KEY" = "pk_live_your_production_clerk_key" ]; then
    echo -e "${RED}✗ VITE_CLERK_PUBLISHABLE_KEY not configured in .env.production${NC}"
    exit 1
fi

if [ "$VITE_ENABLE_DEBUG" = "true" ]; then
    echo -e "${YELLOW}⚠ Warning: Debug mode is enabled in production!${NC}"
    read -p "Continue anyway? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Display configuration
echo -e "${GREEN}Production Configuration:${NC}"
echo -e "  API URL: ${VITE_API_BASE_URL}"
echo -e "  API Version: ${VITE_API_VERSION}"
echo -e "  App Base Path: ${VITE_APP_BASE_PATH}"
echo -e "  Analytics: ${VITE_ENABLE_ANALYTICS}"
echo -e "  Build Target: ${VITE_BUILD_TARGET}"
echo ""

# Clean previous builds
echo -e "${YELLOW}🧹 Cleaning previous builds...${NC}"
rm -rf dist

# Install production dependencies
echo -e "${YELLOW}📦 Installing production dependencies...${NC}"
npm ci --production=false

# Run linting
echo -e "${YELLOW}🔍 Running linting...${NC}"
npm run lint || {
    echo -e "${RED}✗ Linting failed!${NC}"
    exit 1
}

# Run tests
echo -e "${YELLOW}🧪 Running tests...${NC}"
npm run test:ci || {
    echo -e "${RED}✗ Tests failed!${NC}"
    exit 1
}

# Build for production
echo -e "${YELLOW}🔨 Building for production...${NC}"
npm run build || {
    echo -e "${RED}✗ Build failed!${NC}"
    exit 1
}

# Check build output
if [ -d "dist" ]; then
    BUILD_SIZE=$(du -sh dist | cut -f1)
    FILE_COUNT=$(find dist -type f | wc -l | tr -d ' ')
    
    echo -e "${GREEN}✓ Build successful!${NC}"
    echo -e "${BLUE}  Build size: ${BUILD_SIZE}${NC}"
    echo -e "${BLUE}  Files: ${FILE_COUNT}${NC}"
    echo ""
    
    # Generate deployment info
    cat > dist/deployment-info.json <<EOF
{
  "buildTime": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "apiUrl": "${VITE_API_BASE_URL}",
  "apiVersion": "${VITE_API_VERSION}",
  "appBasePath": "${VITE_APP_BASE_PATH}",
  "buildTarget": "${VITE_BUILD_TARGET}"
}
EOF
    
    echo -e "${GREEN}📋 Deployment Summary:${NC}"
    echo -e "  • Build completed at: $(date)"
    echo -e "  • Output directory: ./dist"
    echo -e "  • Ready for deployment to: ${VITE_API_BASE_URL}"
    echo ""
    echo -e "${CYAN}Next steps:${NC}"
    echo -e "  1. Deploy the contents of ./dist to your web server"
    echo -e "  2. Configure your web server to serve index.html for all routes"
    echo -e "  3. Set up proper CORS headers if needed"
    echo -e "  4. Configure SSL/TLS certificates"
else
    echo -e "${RED}✗ Build directory not found!${NC}"
    exit 1
fi 