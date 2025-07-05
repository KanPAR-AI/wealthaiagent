#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Script options
RUN_COVERAGE=false
RUN_WATCH=false
SKIP_BUILD=false
SKIP_TESTS=false

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --coverage)
            RUN_COVERAGE=true
            shift
            ;;
        --watch)
            RUN_WATCH=true
            shift
            ;;
        --skip-build)
            SKIP_BUILD=true
            shift
            ;;
        --skip-tests)
            SKIP_TESTS=true
            shift
            ;;
        --help)
            echo "Usage: $0 [options]"
            echo "Options:"
            echo "  --coverage    Run tests with coverage report"
            echo "  --watch       Run tests in watch mode"
            echo "  --skip-build  Skip the build step"
            echo "  --skip-tests  Skip running tests"
            echo "  --help        Show this help message"
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

echo -e "${CYAN}╔════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║   Local Development Test Runner        ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════╝${NC}"
echo ""

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo -e "${RED}✗ npm is not installed. Please install Node.js and npm first.${NC}"
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo -e "${YELLOW}⚠ Warning: Node.js version is less than 18. Some features may not work correctly.${NC}"
    echo -e "${YELLOW}  Current version: $(node -v)${NC}"
    echo -e "${YELLOW}  Recommended: v18.0.0 or higher${NC}"
fi

# Install dependencies if needed
if [ ! -d "node_modules" ] || [ "package.json" -nt "node_modules" ]; then
    echo -e "${YELLOW}📦 Installing dependencies...${NC}"
    npm install
    if [ $? -ne 0 ]; then
        echo -e "${RED}✗ Failed to install dependencies${NC}"
        exit 1
    fi
    echo -e "${GREEN}✓ Dependencies installed${NC}"
fi

# Run linting
echo -e "\n${YELLOW}🔍 Running linting...${NC}"
npm run lint
if [ $? -ne 0 ]; then
    echo -e "${RED}✗ Linting failed! Please fix the linting errors.${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Linting passed${NC}"

# Run unit tests (unless skipped)
if [ "$SKIP_TESTS" = false ]; then
    echo -e "\n${YELLOW}🧪 Running unit tests...${NC}"
    
    if [ "$RUN_WATCH" = true ]; then
        # Run tests in watch mode
        npm run test:watch
    elif [ "$RUN_COVERAGE" = true ]; then
        # Run tests with coverage
        npm run test:coverage
        echo -e "\n${BLUE}📊 Coverage report generated in ./coverage${NC}"
        
        # Generate test summary
        echo -e "\n${YELLOW}📝 Generating test summary...${NC}"
        npm run test:summary
        if [ -f "TEST_SUMMARY.md" ]; then
            echo -e "${GREEN}✓ Test summary available in TEST_SUMMARY.md${NC}"
        fi
    else
        # Run standard CI tests
        npm run test:ci
    fi
    
    if [ $? -ne 0 ]; then
        echo -e "${RED}✗ Tests failed! Please fix the failing tests.${NC}"
        echo -e "${YELLOW}  Run with --skip-tests to skip this step${NC}"
        exit 1
    fi
    echo -e "${GREEN}✓ All tests passed!${NC}"
else
    echo -e "\n${YELLOW}⚠ Skipping tests (--skip-tests flag used)${NC}"
fi

# Run build (unless skipped or in watch mode)
if [ "$SKIP_BUILD" = false ] && [ "$RUN_WATCH" = false ]; then
    echo -e "\n${YELLOW}🔨 Building application...${NC}"
    npm run build
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Build successful!${NC}"
        
        # Check build size
        if [ -d "dist" ]; then
            BUILD_SIZE=$(du -sh dist | cut -f1)
            echo -e "${BLUE}  Build size: ${BUILD_SIZE}${NC}"
        fi
    else
        echo -e "${RED}✗ Build failed!${NC}"
        exit 1
    fi
else
    if [ "$SKIP_BUILD" = true ]; then
        echo -e "\n${YELLOW}⚠ Skipping build (--skip-build flag used)${NC}"
    fi
fi

# Start development server (unless in watch mode)
if [ "$RUN_WATCH" = false ]; then
    echo -e "\n${GREEN}🚀 Starting development server...${NC}"
    echo -e "${BLUE}  URL: http://localhost:5173${NC}"
    echo -e "${BLUE}  Press Ctrl+C to stop${NC}\n"
    npm run dev
fi

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

# Run specific test file
# npm test -- src/hooks/__tests__/use-jwt-token.test.ts

# Run tests matching a pattern
# npm test -- --testNamePattern="TC_001"

# Update test snapshots
# npm test -- -u

# Debug tests
# node --inspect-brk node_modules/.bin/jest --runInBand

