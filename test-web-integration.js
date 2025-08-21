// Test web app integration with shared packages
console.log('🧪 Testing web app integration with shared packages...');

try {
  // Test if we can import from shared packages
  console.log('📦 Testing @wealthwise/types...');
  const types = require('./packages/types/dist/index.js');
  console.log('✅ Types package accessible');
  
  console.log('📦 Testing @wealthwise/hooks...');
  const hooks = require('./packages/hooks/dist/index.js');
  console.log('✅ Hooks package accessible');
  
  console.log('🌐 Testing web app imports...');
  
  // Test web app specific files
  const webHook = require('./apps/web/src/hooks/use-jwt-token-web.ts');
  console.log('✅ Web hook file accessible');
  
  console.log('\n🎉 Web app integration successful!');
  console.log('The web app should now be able to use shared packages.');
  
} catch (error) {
  console.error('❌ Integration test failed:', error.message);
  console.log('\n💡 Check that:');
  console.log('   1. Packages are built (run build-packages-manual.js)');
  console.log('   2. Dependencies are installed (run pnpm install)');
  console.log('   3. Workspace is properly configured');
}
