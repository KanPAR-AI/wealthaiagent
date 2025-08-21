#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🚀 Setting up YourFinAdvisor Mobile for Production...');

// Check if .env already exists
const envPath = path.join(__dirname, '.env');
const templatePath = path.join(__dirname, 'env.production.template');

if (fs.existsSync(envPath)) {
    console.log('⚠️  .env file already exists. Backing up to .env.backup...');
    fs.copyFileSync(envPath, path.join(__dirname, '.env.backup'));
    console.log('✅ Backup created: .env.backup');
}

// Copy production environment file
console.log('📋 Copying production environment configuration...');
try {
    const templateContent = fs.readFileSync(templatePath, 'utf8');
    fs.writeFileSync(envPath, templateContent);
    console.log('✅ Production environment file created: .env');
} catch (error) {
    console.error('❌ Failed to create .env file:', error.message);
    process.exit(1);
}

console.log('');
console.log('🔧 Configuration Summary:');
console.log('   Backend URL: https://chatbackend.yourfinadvisor.com');
console.log('   API Endpoint: https://chatbackend.yourfinadvisor.com/api/v1');
console.log('   Environment: Production');
console.log('   Debug Mode: Disabled');
console.log('');
console.log('📱 Next Steps:');
console.log('   1. Run: pnpm install (to install updated dependencies)');
console.log('   2. Restart your mobile app');
console.log('   3. The app will now connect to production backend');
console.log('');
console.log('🎯 Benefits of Production Setup:');
console.log('   ✅ Works on all platforms (Android, iOS, physical devices)');
console.log('   ✅ No localhost IP configuration needed');
console.log('   ✅ Secure HTTPS connection');
console.log('   ✅ Accessible from anywhere with internet');
console.log('');
console.log('🔍 To verify setup, check your .env file contains:');
console.log('   EXPO_PUBLIC_API_BASE_URL=https://chatbackend.yourfinadvisor.com');
console.log('');
console.log('🎉 Production setup complete!');
console.log('   Your mobile app is now configured to use the production backend.');
