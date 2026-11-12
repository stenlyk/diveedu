// Vygeneruje PNG ikony PWA z public/favicon.svg.
import { mkdirSync, readFileSync } from 'node:fs';
import sharp from 'sharp';

const svg = readFileSync('public/favicon.svg');
mkdirSync('public/icons', { recursive: true });
const render = (size) => sharp(svg, { density: 300 }).resize(size, size);

await render(192).png().toFile('public/icons/icon-192.png');
await render(512).png().toFile('public/icons/icon-512.png');
await render(180).flatten({ background: '#0b1418' }).png().toFile('public/apple-touch-icon.png');
// Maskable: obsah v bezpečné zóně (80 %), pozadí do krajů.
await sharp({ create: { width: 512, height: 512, channels: 4, background: '#0b1418' } })
  .composite([{ input: await render(400).png().toBuffer(), gravity: 'center' }])
  .png()
  .toFile('public/icons/icon-maskable-512.png');
console.log('✓ ikony vygenerovány');
