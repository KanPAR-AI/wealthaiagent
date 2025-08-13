#!/bin/bash

echo "🚀 Installing dependencies for all packages..."

# Install root dependencies
echo "📦 Installing root dependencies..."
pnpm install

# Install web app dependencies
echo "🌐 Installing web app dependencies..."
cd apps/web && pnpm install && cd ../..

# Install mobile app dependencies  
echo "📱 Installing mobile app dependencies..."
cd apps/mobile && pnpm install && cd ../..

echo "✅ All dependencies installed successfully!"
echo ""
echo "Available commands:"
echo "  pnpm dev          - Start all dev servers"
echo "  pnpm dev:web      - Start web dev server only"
echo "  pnpm dev:mobile   - Start mobile dev server only"
echo "  pnpm build        - Build all packages"
echo "  pnpm lint         - Lint all packages"
echo "  pnpm test         - Test all packages"
echo ""
echo "Turbo commands:"
echo "  pnpm turbo dev --filter=wealthaiagent    - Start web only"
echo "  pnpm turbo dev --filter=mobile           - Start mobile only"
echo "  pnpm turbo build --filter=wealthaiagent  - Build web only"
echo "  pnpm turbo build --filter=mobile         - Build mobile only"
echo "  pnpm turbo lint --filter=wealthaiagent   - Lint web only"
echo "  pnpm turbo lint --filter=mobile          - Lint mobile only"
echo "  pnpm turbo test --filter=wealthaiagent   - Test web only"
echo "  pnpm turbo test --filter=mobile          - Test mobile only"
