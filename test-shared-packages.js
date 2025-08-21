// Simple test to verify shared packages can be imported
// This will help us test the extraction before fully integrating

console.log('🧪 Testing shared package imports...');

try {
  // Test types package
  console.log('📦 Testing @wealthwise/types...');
  const types = require('./packages/types/dist/index.js');
  console.log('✅ Types package imported successfully');
  console.log('   Available exports:', Object.keys(types));
  
  // Test hooks package
  console.log('📦 Testing @wealthwise/hooks...');
  const hooks = require('./packages/hooks/dist/index.js');
  console.log('✅ Hooks package imported successfully');
  console.log('   Available exports:', Object.keys(hooks));
  
  console.log('\n🎉 All shared packages working correctly!');
  
} catch (error) {
  console.error('❌ Error importing shared packages:', error.message);
  console.log('\n💡 Make sure to run: ./scripts/build-packages.sh first');
}
