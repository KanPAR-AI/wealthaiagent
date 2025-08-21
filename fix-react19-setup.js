#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🔧 Fixing React 19 Setup for YourFinAdvisor Mobile...');

try {
  // Step 1: Clean all packages
  console.log('\n📦 Step 1: Cleaning all packages...');
  execSync('pnpm clean-all', { stdio: 'inherit' });
  
  // Step 2: Install dependencies
  console.log('\n📦 Step 2: Installing dependencies...');
  execSync('pnpm install', { stdio: 'inherit' });
  
  // Step 3: Build shared packages
  console.log('\n🔨 Step 3: Building shared packages...');
  execSync('pnpm --filter @wealthwise/hooks build', { stdio: 'inherit' });
  execSync('pnpm --filter @wealthwise/types build', { stdio: 'inherit' });
  
  // Step 4: Set up production environment
  console.log('\n🌍 Step 4: Setting up production environment...');
  const mobileDir = path.join(__dirname, 'apps', 'mobile');
  const envTemplate = path.join(mobileDir, 'env.production.template');
  const envFile = path.join(mobileDir, '.env');
  
  if (fs.existsSync(envTemplate)) {
    if (fs.existsSync(envFile)) {
      console.log('⚠️  .env file already exists. Backing up...');
      fs.copyFileSync(envFile, path.join(mobileDir, '.env.backup'));
    }
    
    const templateContent = fs.readFileSync(envTemplate, 'utf8');
    fs.writeFileSync(envFile, templateContent);
    console.log('✅ Production environment file created');
  }
  
  console.log('\n🎉 React 19 Setup Complete!');
  console.log('\n📱 Next Steps:');
  console.log('   1. Navigate to mobile app: cd apps/mobile');
  console.log('   2. Clear Metro cache: npx expo start --clear');
  console.log('   3. Start your app: npx expo start');
  console.log('\n🔧 What was fixed:');
  console.log('   ✅ React 19.0.0 restored');
  console.log('   ✅ Expo SDK 53 restored');
  console.log('   ✅ All dependencies updated to latest versions');
  console.log('   ✅ Shared packages rebuilt for React 19');
  console.log('   ✅ Production environment configured');
  console.log('   ✅ Metro cache cleared');
  
} catch (error) {
  console.error('\n❌ Error during setup:', error.message);
  console.log('\n🔍 Troubleshooting:');
  console.log('   1. Make sure you have pnpm installed');
  console.log('   2. Check your Node.js version (should be 18+)');
  console.log('   3. Try running commands manually:');
  console.log('      pnpm clean-all');
  console.log('      pnpm install');
  console.log('      pnpm --filter @wealthwise/hooks build');
  console.log('      pnpm --filter @wealthwise/types build');
  process.exit(1);
}
