#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Colors for console output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

const envFiles = {
  local: '.env.local',
  production: '.env.production',
  example: 'config/env.example'
};

const requiredVars = [
  'VITE_CLERK_PUBLISHABLE_KEY',
  'VITE_API_BASE_URL',
  'VITE_API_VERSION'
];

const optionalVars = [
  'VITE_APP_BASE_PATH',
  'VITE_APP_NAME',
  'VITE_APP_PORT',
  'VITE_ENABLE_ANALYTICS',
  'VITE_ENABLE_DEBUG',
  'VITE_BUILD_TARGET',
  'VITE_SENTRY_DSN',
  'VITE_GA_TRACKING_ID'
];

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  
  const content = fs.readFileSync(filePath, 'utf8');
  const vars = {};
  
  content.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=');
      if (key) {
        vars[key.trim()] = valueParts.join('=').trim();
      }
    }
  });
  
  return vars;
}

function checkEnvironment(envName, filePath) {
  console.log(`\n${colors.blue}Checking ${envName} environment (${filePath})...${colors.reset}`);
  
  const vars = parseEnvFile(filePath);
  
  if (!vars) {
    console.log(`${colors.red}✗ File not found${colors.reset}`);
    return false;
  }
  
  let hasErrors = false;
  
  // Check required variables
  console.log('\nRequired variables:');
  requiredVars.forEach(varName => {
    if (vars[varName] && !vars[varName].includes('your_') && !vars[varName].includes('_here')) {
      console.log(`  ${colors.green}✓${colors.reset} ${varName}: ${vars[varName]}`);
    } else {
      console.log(`  ${colors.red}✗${colors.reset} ${varName}: ${vars[varName] || 'NOT SET'}`);
      hasErrors = true;
    }
  });
  
  // Check optional variables
  console.log('\nOptional variables:');
  optionalVars.forEach(varName => {
    if (vars[varName]) {
      console.log(`  ${colors.green}✓${colors.reset} ${varName}: ${vars[varName]}`);
    } else {
      console.log(`  ${colors.yellow}-${colors.reset} ${varName}: NOT SET`);
    }
  });
  
  // Environment-specific checks
  if (envName === 'Production') {
    if (vars['VITE_ENABLE_DEBUG'] === 'true') {
      console.log(`\n${colors.yellow}⚠ Warning: Debug mode is enabled in production!${colors.reset}`);
    }
    if (vars['VITE_TEST_USERNAME'] || vars['VITE_TEST_PASSWORD']) {
      console.log(`${colors.red}⚠ Warning: Test credentials found in production config!${colors.reset}`);
      hasErrors = true;
    }
  }
  
  return !hasErrors;
}

// Main execution
console.log(`${colors.blue}╔════════════════════════════════════════╗${colors.reset}`);
console.log(`${colors.blue}║   Environment Configuration Checker    ║${colors.reset}`);
console.log(`${colors.blue}╚════════════════════════════════════════╝${colors.reset}`);

const localValid = checkEnvironment('Local', envFiles.local);
const prodValid = checkEnvironment('Production', envFiles.production);

console.log('\n' + '='.repeat(40));
console.log('\nSummary:');

if (localValid && prodValid) {
  console.log(`${colors.green}✓ All environments are properly configured!${colors.reset}`);
  process.exit(0);
} else {
  if (!localValid && !fs.existsSync(envFiles.local)) {
    console.log(`\n${colors.yellow}To create local environment:${colors.reset}`);
    console.log(`  npm run env:init`);
  }
  if (!prodValid && !fs.existsSync(envFiles.production)) {
    console.log(`\n${colors.yellow}To create production environment:${colors.reset}`);
    console.log(`  cp config/env.production.example .env.production`);
  }
  console.log(`\n${colors.red}✗ Some environments need configuration${colors.reset}`);
  process.exit(1);
} 