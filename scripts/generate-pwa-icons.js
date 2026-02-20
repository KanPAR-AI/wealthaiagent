#!/usr/bin/env node

/**
 * PWA Icon Generator for WealthWise AI
 * 
 * This script generates placeholder PWA icons in all required sizes.
 * For production, replace these with your actual brand icons.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create icons directory if it doesn't exist
const iconsDir = path.join(__dirname, '..', 'public', 'icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// Required icon sizes for PWA
const sizes = [16, 32, 72, 96, 128, 144, 152, 192, 384, 512];

console.log('🎨 Generating PWA icons for WealthWise AI...');

// Create a simple SVG template for each size
const createSVGIcon = (size) => {
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#128C7E;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#075E54;stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" fill="url(#grad)" rx="${size * 0.1}"/>
  <g fill="white" opacity="0.9">
    <!-- Chart bars -->
    <rect x="${size * 0.25}" y="${size * 0.6}" width="${size * 0.08}" height="${size * 0.25}"/>
    <rect x="${size * 0.4}" y="${size * 0.45}" width="${size * 0.08}" height="${size * 0.4}"/>
    <rect x="${size * 0.55}" y="${size * 0.35}" width="${size * 0.08}" height="${size * 0.5}"/>
    <rect x="${size * 0.7}" y="${size * 0.5}" width="${size * 0.08}" height="${size * 0.35}"/>
    <!-- AI text -->
    <text x="${size * 0.5}" y="${size * 0.75}" text-anchor="middle" font-family="Arial, sans-serif" font-size="${size * 0.12}" font-weight="bold">AI</text>
  </g>
</svg>`;
};

// Generate SVG files for each size
sizes.forEach(size => {
  const svgContent = createSVGIcon(size);
  const filename = `icon-${size}x${size}.svg`;
  const filepath = path.join(iconsDir, filename);
  
  fs.writeFileSync(filepath, svgContent);
  console.log(`✅ Generated ${filename}`);
});

// Create a README for the icons directory
const readmeContent = `# PWA Icons

This directory contains the PWA icons for WealthWise AI.

## Current Status
⚠️ **Placeholder Icons**: The current icons are generated placeholders. For production, replace these with your actual brand icons.

## Required Icons
- icon-16x16.svg
- icon-32x32.svg  
- icon-72x72.svg
- icon-96x96.svg
- icon-128x128.svg
- icon-144x144.svg
- icon-152x152.svg
- icon-192x192.svg
- icon-384x384.svg
- icon-512x512.svg

## Converting to PNG
To convert SVG icons to PNG format:

1. Use an online SVG to PNG converter
2. Use ImageMagick: \`convert icon-192x192.svg icon-192x192.png\`
3. Use Inkscape: \`inkscape --export-png=icon-192x192.png icon-192x192.svg\`

## Design Guidelines
- Use your brand colors and logo
- Ensure icons are readable at small sizes
- Maintain consistent visual style
- Test on various backgrounds (light/dark)

## Testing
After updating icons:
1. Clear browser cache
2. Test PWA installation
3. Verify icons display correctly in standalone mode
`;

fs.writeFileSync(path.join(iconsDir, 'README.md'), readmeContent);

console.log('\n🎉 PWA icon generation complete!');
console.log('\n📝 Next steps:');
console.log('1. Replace placeholder icons with your brand icons');
console.log('2. Convert SVG to PNG format if needed');
console.log('3. Test PWA installation');
console.log('\n📁 Icons saved to: ' + iconsDir);
