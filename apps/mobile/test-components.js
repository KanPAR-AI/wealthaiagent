#!/usr/bin/env node

/**
 * Simple test script to verify mobile components can be imported
 * Run with: node test-components.js
 */

console.log('🧪 Testing mobile component imports...\n');

const components = [
  'chat-window',
  'prompt-input', 
  'message-list',
  'chat-bubble',
  'message-actions',
  'suggestion-tiles',
  'chat-empty-state',
  'ai-loading-indicator',
  'chat-loading-skeleton',
  'file-renderer'
];

let successCount = 0;
let errorCount = 0;

components.forEach(component => {
  try {
    // Try to require the component
    require(`./components/chat/${component}.tsx`);
    console.log(`✅ ${component} - OK`);
    successCount++;
  } catch (error) {
    console.log(`❌ ${component} - ERROR: ${error.message}`);
    errorCount++;
  }
});

console.log(`\n📊 Results: ${successCount}/${components.length} components imported successfully`);

if (errorCount > 0) {
  console.log(`\n⚠️  ${errorCount} components failed to import`);
  process.exit(1);
} else {
  console.log('\n🎉 All components imported successfully!');
  process.exit(0);
}
