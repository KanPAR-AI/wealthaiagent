// Manual build script for packages
// This will create the dist folders with compiled JavaScript

const fs = require('fs');
const path = require('path');

console.log('🏗️ Building packages manually...');

// Create dist directories
const packages = ['types', 'hooks'];

packages.forEach(pkg => {
  const pkgPath = path.join(__dirname, 'packages', pkg);
  const distPath = path.join(pkgPath, 'dist');
  
  if (!fs.existsSync(distPath)) {
    fs.mkdirSync(distPath, { recursive: true });
  }
  
  // Copy source files to dist (simple approach)
  const srcPath = path.join(pkgPath, 'src');
  if (fs.existsSync(srcPath)) {
    const files = fs.readdirSync(srcPath);
    files.forEach(file => {
      if (file.endsWith('.ts')) {
        const srcFile = path.join(srcPath, file);
        const distFile = path.join(distPath, file.replace('.ts', '.js'));
        
        // Simple TypeScript to JavaScript conversion (basic)
        let content = fs.readFileSync(srcFile, 'utf8');
        
        // Remove TypeScript syntax
        content = content.replace(/:\s*[^=]+(?=\s*[,)])/g, ''); // Remove type annotations
        content = content.replace(/import\s*{[^}]+}\s*from\s*['"][^'"]+['"];?\s*/g, ''); // Remove imports
        content = content.replace(/export\s+/g, ''); // Remove export keywords
        content = content.replace(/interface\s+\w+\s*{[^}]*}/g, ''); // Remove interfaces
        content = content.replace(/type\s+\w+\s*=\s*[^;]+;/g, ''); // Remove type aliases
        
        fs.writeFileSync(distFile, content);
        console.log(`✅ Built ${pkg}/${file} -> ${pkg}/dist/${file.replace('.ts', '.js')}`);
      }
    });
  }
  
  // Create package.json for dist
  const packageJson = {
    name: `@wealthwise/${pkg}`,
    version: "0.1.0",
    main: "./index.js",
    types: "./index.d.ts"
  };
  
  fs.writeFileSync(
    path.join(distPath, 'package.json'),
    JSON.stringify(packageJson, null, 2)
  );
  
  // Create index.js
  const indexContent = `// Auto-generated from ${pkg} package
module.exports = require('./index.js');`;
  
  fs.writeFileSync(path.join(distPath, 'index.js'), indexContent);
});

console.log('✅ Manual build complete!');
console.log('Note: This is a basic build. For production, use tsup.');
