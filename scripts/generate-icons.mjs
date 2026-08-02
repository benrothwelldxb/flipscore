// Generates the PWA icon set (and favicon) from an inline SVG mark so the
// artwork is reproducible and versioned. Run with `npm run generate:icons`.
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const publicDir = resolve(root, 'public')

const gradient = `
  <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#8b5cf6" />
    <stop offset="1" stop-color="#6366f1" />
  </linearGradient>`

const cards = `
  <rect x="150" y="118" width="212" height="276" rx="34" fill="#ffffff" opacity="0.4" transform="rotate(-9 256 256)" />
  <rect x="150" y="118" width="212" height="276" rx="34" fill="#ffffff" />
  <line x1="150" y1="256" x2="362" y2="256" stroke="#6366f1" stroke-width="8" stroke-dasharray="2 14" stroke-linecap="round" />
  <circle cx="202" cy="182" r="16" fill="#ef4444" />
  <circle cx="310" cy="330" r="16" fill="#6366f1" />`

const iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>${gradient}</defs>
  <rect x="16" y="16" width="480" height="480" rx="112" fill="url(#g)" />
  ${cards}
</svg>`

// Maskable: full-bleed background with content pulled into the safe zone.
const maskableSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>${gradient}</defs>
  <rect width="512" height="512" fill="url(#g)" />
  <g transform="translate(256 256) scale(0.72) translate(-256 -256)">${cards}</g>
</svg>`

async function png(svg, size, name) {
  await sharp(Buffer.from(svg))
    .resize(size, size)
    .png()
    .toFile(resolve(publicDir, name))
  console.log(`  ✓ ${name} (${size}×${size})`)
}

async function main() {
  await mkdir(publicDir, { recursive: true })
  console.log('Generating FlipScore icons…')
  await png(iconSvg, 192, 'pwa-192x192.png')
  await png(iconSvg, 512, 'pwa-512x512.png')
  await png(maskableSvg, 512, 'maskable-512x512.png')
  await png(maskableSvg, 180, 'apple-touch-icon.png')
  await writeFile(resolve(publicDir, 'favicon.svg'), `${iconSvg}\n`, 'utf8')
  console.log('  ✓ favicon.svg')
  console.log('Done.')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
