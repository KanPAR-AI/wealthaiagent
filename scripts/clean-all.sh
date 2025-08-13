#!/bin/bash

echo "🧹 Cleaning all packages..."

# Clean using turbo
echo "🗑️ Cleaning build artifacts and caches..."
pnpm turbo clean

# Remove node_modules (optional - uncomment if needed)
# echo "🗑️ Removing node_modules (optional)..."
# rm -rf node_modules
# rm -rf apps/*/node_modules

# Remove dist folders
echo "🗑️ Removing dist folders..."
rm -rf apps/web/dist
rm -rf apps/web/.turbo
rm -rf apps/mobile/.turbo

# Remove root turbo cache
echo "🗑️ Removing turbo cache..."
rm -rf .turbo

echo "✅ All packages cleaned successfully!"
echo ""
echo "To reinstall dependencies, run: ./scripts/install-all.sh"
