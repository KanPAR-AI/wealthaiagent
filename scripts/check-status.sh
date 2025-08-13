#!/bin/bash

echo "🔍 Checking monorepo status..."

echo ""
echo "📦 Package Manager:"
echo "  pnpm version: $(pnpm --version)"
echo "  Node version: $(node --version)"
echo "  npm version: $(npm --version)"

echo ""
echo "🏗️ Turborepo:"
if command -v turbo &> /dev/null; then
    echo "  ✅ Turbo installed: $(turbo --version)"
else
    echo "  ❌ Turbo not installed"
fi

if [ -f "turbo.json" ]; then
    echo "  ✅ turbo.json exists"
else
    echo "  ❌ turbo.json missing"
fi

echo ""
echo "📱 Apps Status:"
echo "  Web app:"
if [ -d "apps/web" ]; then
    echo "    ✅ Directory exists"
    if [ -f "apps/web/package.json" ]; then
        echo "    ✅ package.json exists"
        echo "    📋 Name: $(cd apps/web && pnpm pkg get name)"
        echo "    📋 Version: $(cd apps/web && pnpm pkg get version)"
    else
        echo "    ❌ package.json missing"
    fi
else
    echo "    ❌ Directory missing"
fi

echo "  Mobile app:"
if [ -d "apps/mobile" ]; then
    echo "    ✅ Directory exists"
    if [ -f "apps/mobile/package.json" ]; then
        echo "    ✅ package.json exists"
        echo "    📋 Name: $(cd apps/mobile && pnpm pkg get name)"
        echo "    📋 Version: $(cd apps/mobile && pnpm pkg get version)"
    else
        echo "    ❌ package.json missing"
    fi
else
    echo "    ❌ Directory missing"
fi

echo ""
echo "🔧 Workspace Configuration:"
if [ -f "pnpm-workspace.yaml" ]; then
    echo "  ✅ pnpm-workspace.yaml exists"
    echo "  📋 Content:"
    cat pnpm-workspace.yaml | sed 's/^/    /'
else
    echo "  ❌ pnpm-workspace.yaml missing"
fi

echo ""
echo "📋 Root package.json scripts:"
pnpm pkg get scripts | sed 's/^/  /'

echo ""
echo "✅ Status check complete!"
