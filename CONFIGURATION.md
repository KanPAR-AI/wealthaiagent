# Configuration Guide

This guide explains how to configure the WealthAI Agent application for different environments.

## Table of Contents
- [Overview](#overview)
- [Environment Variables](#environment-variables)
- [Quick Start](#quick-start)
- [Environment Files](#environment-files)
- [Deployment Scripts](#deployment-scripts)
- [Switching Between Environments](#switching-between-environments)
- [Security Best Practices](#security-best-practices)

## Overview

The application uses environment variables to manage configuration across different environments (local, staging, production). All configuration is centralized in `src/config/environment.ts` which provides type-safe access to environment variables.

## Environment Variables

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `VITE_CLERK_PUBLISHABLE_KEY` | Clerk authentication public key | `pk_test_...` or `pk_live_...` |
| `VITE_API_BASE_URL` | Backend API base URL | `http://localhost:8080` |
| `VITE_API_VERSION` | API version | `v1` |

### Optional Variables

| Variable | Description | Default | Example |
|----------|-------------|---------|---------|
| `VITE_APP_BASE_PATH` | Application base path | `/chataiagent` | `/` or `/app` |
| `VITE_APP_NAME` | Application name | `WealthAI Agent` | `My App` |
| `VITE_APP_PORT` | Development server port | `5173` | `3000` |
| `VITE_ENABLE_ANALYTICS` | Enable analytics tracking | `false` | `true` |
| `VITE_ENABLE_DEBUG` | Enable debug mode | `false` | `true` |
| `VITE_BUILD_TARGET` | Build target environment | `production` | `development`, `staging` |
| `VITE_SENTRY_DSN` | Sentry error tracking DSN | - | `https://...@sentry.io/...` |
| `VITE_GA_TRACKING_ID` | Google Analytics ID | - | `G-XXXXXXXXXX` |

### Test Variables (Development Only)

| Variable | Description | Example |
|----------|-------------|---------|
| `VITE_TEST_USERNAME` | Test username for development | `testuser` |
| `VITE_TEST_PASSWORD` | Test password for development | `testpass123` |

⚠️ **Never include test credentials in production environment files!**

## Quick Start

### 1. Initialize Local Environment

```bash
# Create .env.local from example
npm run env:init

# Edit .env.local with your values
nano .env.local
```

### 2. Check Configuration

```bash
# Verify all environment files are properly configured
npm run env:check
```

### 3. Run Local Development

```bash
# Using the enhanced test-local script
./test-local.sh

# Or using the deployment script
npm run deploy:local
```

## Environment Files

### File Structure

```
wealthaiagent/
├── .env.local          # Local development (git ignored)
├── .env.production     # Production build (git ignored)
├── config/
│   ├── env.example     # Example for local development
│   └── env.production.example  # Example for production
```

### Creating Environment Files

#### Local Development (.env.local)

```bash
# Copy from example
cp config/env.example .env.local

# Edit with your local values
# Typical local configuration:
VITE_CLERK_PUBLISHABLE_KEY=pk_test_your_clerk_test_key
VITE_API_BASE_URL=http://localhost:8080
VITE_API_VERSION=v1
VITE_ENABLE_DEBUG=true
VITE_BUILD_TARGET=development
```

#### Production (.env.production)

```bash
# Copy from example
cp config/env.production.example .env.production

# Edit with production values
# Typical production configuration:
VITE_CLERK_PUBLISHABLE_KEY=pk_live_your_clerk_live_key
VITE_API_BASE_URL=https://chatbackend.yourfinadvisor.com
VITE_API_VERSION=v1
VITE_APP_BASE_PATH=/chataiagent
VITE_ENABLE_ANALYTICS=true
VITE_ENABLE_DEBUG=false
VITE_BUILD_TARGET=production
```

## Deployment Scripts

### Local Development

```bash
# Full local deployment with tests
npm run deploy:local

# Or use test-local with options
./test-local.sh --coverage    # Run with coverage
./test-local.sh --watch       # Run tests in watch mode
./test-local.sh --skip-tests  # Skip tests
./test-local.sh --skip-build  # Skip build
```

### Production Build

```bash
# Build for production
npm run deploy:production

# Deploy to Google Cloud Platform
npm run deploy:gcp
```

### Script Features

All deployment scripts include:
- ✅ Environment validation
- 📦 Dependency installation
- 🔍 Code linting
- 🧪 Test execution
- 🔨 Production build
- 📊 Build size reporting

## Switching Between Environments

### Using Different API Endpoints

The application automatically uses the configured API endpoint based on the environment:

```typescript
// In your code, use the helper function
import { getApiUrl } from '@/config/environment';

// Automatically uses the right base URL
const response = await fetch(getApiUrl('/auth/token'));
// Local: http://localhost:8080/api/v1/auth/token
// Production: https://chatbackend.yourfinadvisor.com/api/v1/auth/token
```

### Building for Different Environments

```bash
# Build with local configuration
npm run build

# Build with production configuration
NODE_ENV=production npm run build
```

## Security Best Practices

### 1. Never Commit Environment Files

Ensure these files are in `.gitignore`:
```
.env
.env.local
.env.production
.env.*.local
```

### 2. Use Different Keys for Different Environments

- Use `pk_test_...` Clerk keys for development
- Use `pk_live_...` Clerk keys for production
- Never share keys between environments

### 3. Validate Production Configuration

The deployment scripts automatically check for:
- Debug mode disabled in production
- No test credentials in production
- Required variables are set
- Build target matches environment

### 4. Secure Storage

For production deployments:
- Use environment variables in your CI/CD system
- Use secret management services (Google Secret Manager, AWS Secrets Manager)
- Rotate keys regularly
- Monitor for exposed credentials

## Troubleshooting

### Common Issues

1. **Missing environment file**
   ```bash
   # Create from example
   npm run env:init
   ```

2. **Invalid configuration**
   ```bash
   # Check configuration
   npm run env:check
   ```

3. **Wrong API endpoint**
   - Verify `VITE_API_BASE_URL` in your environment file
   - Check network tab in browser DevTools

4. **Authentication failures**
   - Ensure you're using the correct Clerk key for your environment
   - Check Clerk dashboard for key status

### Debug Mode

Enable debug mode to see configuration in console:
```bash
# In .env.local
VITE_ENABLE_DEBUG=true
```

This will log the configuration (excluding sensitive values) on startup. 