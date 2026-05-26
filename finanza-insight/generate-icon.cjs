const fs = require('fs');
const { createCanvas } = require('canvas');

function generateIcon(size, filename) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  // Background gradient: sleek dark teal to emerald
  const gradient = ctx.createLinearGradient(0, 0, size, size);
  gradient.addColorStop(0, '#004d40'); // Dark Teal
  gradient.addColorStop(1, '#00BFA5'); // Bright Teal/Emerald
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  // Add a soft inner shadow (by drawing a smaller rounded rect or gradient)
  // We'll keep it simple: draw a stylized 'F' and a sparkly star
  
  // Set text properties
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  
  // The 'F'
  ctx.font = `bold ${size * 0.55}px -apple-system, system-ui, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`;
  ctx.fillText('FD', size * 0.5, size * 0.52);

  // Buffer to PNG
  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(`./public/${filename}`, buffer);
  console.log(`Generated ./public/${filename}`);
}

generateIcon(192, 'icon-192.png');
generateIcon(512, 'icon-512.png');
generateIcon(180, 'apple-touch-icon.png');
