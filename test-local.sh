#!/bin/bash

# Simple local test script
echo -e "\033[1;33mSetting up local environment...\033[0m"

# Install dependencies with legacy peer deps
echo -e "\n\033[1;36mRunning npm install with legacy peer deps...\033[0m"
npm i --legacy-peer-deps

# Start development server
echo -e "\n\033[1;36mStarting development server...\033[0m"
npm run dev

# Alternative commands (commented out)
# To use these, just uncomment and place them where needed

# Run tests
# echo -e "\n\033[1;36mRunning tests...\033[0m"
# npm test

# Run with different port
# PORT=3000 npm run dev

# Build for production
# echo -e "\n\033[1;36mBuilding for production...\033[0m"
# npm run build

# Preview production build
# echo -e "\n\033[1;36mPreviewing production build...\033[0m"
# npm run preview

