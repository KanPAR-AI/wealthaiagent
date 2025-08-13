#!/bin/bash

echo "🏗️ Building all packages..."

# Clean previous builds
echo "🧹 Cleaning previous builds..."
pnpm turbo clean

# Build all packages using turbo
echo "🔨 Building packages..."
pnpm turbo build

echo "✅ All packages built successfully!"
echo ""
echo "Build outputs:"
echo "  Web app: apps/web/dist/"
echo "  Mobile app: No build output (uses Expo)"
