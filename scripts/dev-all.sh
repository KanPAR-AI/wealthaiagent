#!/bin/bash

echo "🚀 Starting all development servers..."

# Start all dev servers using turbo
echo "🌐 Starting web and mobile dev servers..."
pnpm turbo dev

echo "✅ All dev servers started!"
echo ""
echo "Web app should be running at: http://localhost:5173"
echo "Mobile app should be running with Expo"
echo ""
echo "Press Ctrl+C to stop all servers"
