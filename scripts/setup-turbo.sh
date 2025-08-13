#!/bin/bash

echo "🚀 Setting up Turborepo..."

# Check if turbo is installed
if ! command -v turbo &> /dev/null; then
    echo "📦 Installing turbo..."
    pnpm add -D turbo
else
    echo "✅ Turbo is already installed"
fi

# Check if turbo.json exists
if [ ! -f "turbo.json" ]; then
    echo "📝 Creating turbo.json..."
    cat > turbo.json << 'EOF'
{
  "$schema": "https://turbo.build/schema.json",
  "globalDependencies": ["**/.env.*local"],
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**", "build/**", "dist/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": {
      "dependsOn": ["^lint"]
    },
    "test": {
      "dependsOn": ["^build"]
    },
    "clean": {
      "cache": false
    }
  }
}
EOF
    echo "✅ Created turbo.json"
else
    echo "✅ turbo.json already exists"
fi

# Update root package.json scripts
echo "📝 Updating root package.json scripts..."
pnpm pkg set scripts.dev="turbo dev"
pnpm pkg set scripts.build="turbo build"
pnpm pkg set scripts.lint="turbo lint"
pnpm pkg set scripts.test="turbo test"
pnpm pkg set scripts.clean="turbo clean"
pnpm pkg set scripts.dev:web="turbo dev --filter=wealthaiagent"
pnpm pkg set scripts.dev:mobile="turbo dev --filter=mobile"

echo "✅ Turborepo setup complete!"
echo ""
echo "Available commands:"
echo "  pnpm dev          - Start all dev servers"
echo "  pnpm dev:web      - Start web dev server only"
echo "  pnpm dev:mobile   - Start mobile dev server only"
echo "  pnpm build        - Build all packages"
echo "  pnpm lint         - Lint all packages"
echo "  pnpm test         - Test all packages"
echo "  pnpm clean        - Clean all packages"
