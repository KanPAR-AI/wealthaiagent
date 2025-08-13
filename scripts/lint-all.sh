#!/bin/bash

echo "🔍 Linting all packages..."

# Lint all packages using turbo
echo "📝 Running linting..."
pnpm turbo lint

echo "✅ All packages linted successfully!"
