// Simple verification script to check if the project setup is correct
const fs = require('fs');
const path = require('path');

console.log('🔍 Verifying Vite standalone setup...\n');

// Check if package.json exists and has correct dependencies
const packageJsonPath = path.join(__dirname, 'package.json');
if (fs.existsSync(packageJsonPath)) {
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  
  console.log('✅ package.json found');
  
  // Check for workspace dependencies
  const hasWorkspaceDeps = Object.values(packageJson.dependencies || {}).some(dep => 
    typeof dep === 'string' && dep.includes('workspace:')
  );
  
  if (!hasWorkspaceDeps) {
    console.log('✅ No workspace dependencies found');
  } else {
    console.log('❌ Workspace dependencies still present');
  }
  
  // Check for required dependencies
  const requiredDeps = ['react', 'vite', '@vitejs/plugin-react'];
  const missingDeps = requiredDeps.filter(dep => 
    !packageJson.dependencies?.[dep] && !packageJson.devDependencies?.[dep]
  );
  
  if (missingDeps.length === 0) {
    console.log('✅ All required dependencies present');
  } else {
    console.log('❌ Missing dependencies:', missingDeps.join(', '));
  }
} else {
  console.log('❌ package.json not found');
}

// Check if local type definitions exist
const typesPath = path.join(__dirname, 'src', 'types', 'index.ts');
if (fs.existsSync(typesPath)) {
  console.log('✅ Local type definitions found');
} else {
  console.log('❌ Local type definitions missing');
}

// Check if local hook exists
const hookPath = path.join(__dirname, 'src', 'hooks', 'use-jwt-token.ts');
if (fs.existsSync(hookPath)) {
  console.log('✅ Local hook implementation found');
} else {
  console.log('❌ Local hook implementation missing');
}

// Check if vite config exists
const viteConfigPath = path.join(__dirname, 'vite.config.ts');
if (fs.existsSync(viteConfigPath)) {
  console.log('✅ Vite configuration found');
} else {
  console.log('❌ Vite configuration missing');
}

console.log('\n🎉 Setup verification complete!');
console.log('\nNext steps:');
console.log('1. Clear disk space');
console.log('2. Run: npm install');
console.log('3. Run: npm run dev');
