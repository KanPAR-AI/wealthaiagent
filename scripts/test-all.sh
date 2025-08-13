#!/bin/bash

echo "🧪 Running tests for all packages..."

# Run tests using turbo
echo "📊 Running tests with turbo..."
pnpm turbo test

echo "✅ All tests completed!"
