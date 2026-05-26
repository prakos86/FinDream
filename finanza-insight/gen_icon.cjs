const { createCanvas } = require('canvas');
const fs = require('fs');

function generateIcon(size, outputPath) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  // Solid background (no transparency for iOS!)
  ctx.fillStyle = '#0f172a'; // slate-900
  ctx.fillRect(0, 0, size, size);

  // Gradient
  const grad = ctx.createLinearGradient(0, 0, size, size);
  grad.addColorStop(0, '#059669'); // emerald-600
  grad.addColorStop(1, '#4338ca'); // indigo-600
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  // Text or Logo
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  
  // F inside a circle or simple text
  ctx.font = `bold ${size * 0.5}px "Helvetica Neue"`;
  ctx.fillText('FD', size/2, size/2);

  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(outputPath, buffer);
  console.log(`Generated ${outputPath}`);
}

generateIcon(180, 'public/apple-touch-icon.png');
generateIcon(192, 'public/icon-192.png');
generateIcon(512, 'public/icon-512.png');
generateIcon(32, 'public/favicon.png');
