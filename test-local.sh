#!/bin/bash

# Simple local test script
echo -e "\033[1;33mSetting up local environment...\033[0m"

# Check and set Node.js version
echo -e "\n\033[1;36mChecking Node.js version...\033[0m"
current_node_version=$(node --version 2>/dev/null)
required_node_version="v18.20.7"

if [ "$current_node_version" != "$required_node_version" ]; then
    echo -e "\033[1;33mCurrent Node.js version: $current_node_version\033[0m"
    echo -e "\033[1;33mSwitching to Node.js $required_node_version...\033[0m"
    
    # Source nvm and switch to the required version
    if [ -f "$HOME/.nvm/nvm.sh" ]; then
        source "$HOME/.nvm/nvm.sh"
        nvm use 18.20.7
        
        # Verify the switch was successful
        new_node_version=$(node --version)
        if [ "$new_node_version" == "$required_node_version" ]; then
            echo -e "\033[1;32m✓ Successfully switched to Node.js $required_node_version\033[0m"
        else
            echo -e "\033[1;31m✗ Failed to switch Node.js version. Please install Node.js $required_node_version using: nvm install 18.20.7\033[0m"
            exit 1
        fi
    else
        echo -e "\033[1;31m✗ NVM not found. Please install NVM or Node.js $required_node_version\033[0m"
        exit 1
    fi
else
    echo -e "\033[1;32m✓ Node.js version is already $required_node_version\033[0m"
fi

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

