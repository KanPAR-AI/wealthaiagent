#!/bin/bash

echo "🏗️ Building shared packages..."

# Build types package
echo "📦 Building @wealthwise/types..."
cd packages/types
pnpm build
cd ../..

# Build hooks package
echo "📦 Building @wealthwise/hooks..."
cd packages/hooks
pnpm build
cd ../..

echo "✅ All packages built successfully!"
echo ""
echo "Package outputs:"
echo "  Types: packages/types/dist/"
echo "  Hooks: packages/hooks/dist/"
