// Generates the PWA icon set, favicon, and in-app brand images from the brand
// source assets in ./brand. Run with `npm run generate:icons`.
import { mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const publicDir = resolve(root, 'public')
const brandDir = resolve(root, 'brand')

const NAVY = '#0d0b3d'
const ICON_SRC = resolve(brandDir, 'app-icon.png')
const WORDMARK_SRC = resolve(brandDir, 'wordmark.png')

// Quantised PNGs keep the brand images small for fast mobile loads.
const PNG_OPTS = { palette: true, quality: 90, compressionLevel: 9 }

/** The icon badge with its outer black border trimmed away. */
function trimmedIcon() {
  return sharp(ICON_SRC).trim({ threshold: 20 }).toBuffer()
}

/** A white rounded-rect used as an alpha mask to round icon corners. */
function roundedMask(size) {
  const r = Math.round(size * 0.22)
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${r}" ry="${r}" fill="#fff"/></svg>`,
  )
}

async function roundedIcon(src, size, out) {
  const base = await sharp(src).resize(size, size, { fit: 'cover' }).toBuffer()
  await sharp(base)
    .composite([{ input: roundedMask(size), blend: 'dest-in' }])
    .png(PNG_OPTS)
    .toFile(resolve(publicDir, out))
  console.log('  ✓', out)
}

async function squareIcon(src, size, out) {
  await sharp(src)
    .resize(size, size, { fit: 'cover' })
    .flatten({ background: NAVY })
    .png(PNG_OPTS)
    .toFile(resolve(publicDir, out))
  console.log('  ✓', out)
}

async function maskableIcon(src, size, out) {
  const inner = Math.round(size * 0.84)
  const content = await sharp(src)
    .resize(inner, inner, { fit: 'cover' })
    .toBuffer()
  await sharp({
    create: { width: size, height: size, channels: 4, background: NAVY },
  })
    .composite([{ input: content, gravity: 'center' }])
    .png(PNG_OPTS)
    .toFile(resolve(publicDir, out))
  console.log('  ✓', out)
}

async function main() {
  await mkdir(publicDir, { recursive: true })
  await mkdir(resolve(publicDir, 'brand'), { recursive: true })
  console.log('Generating FlipScorer brand images…')

  const icon = await trimmedIcon()

  // PWA + favicon.
  await roundedIcon(icon, 192, 'pwa-192x192.png')
  await roundedIcon(icon, 512, 'pwa-512x512.png')
  await maskableIcon(icon, 512, 'maskable-512x512.png')
  await squareIcon(icon, 180, 'apple-touch-icon.png')
  await roundedIcon(icon, 48, 'favicon.png')

  // In-app brand images.
  await roundedIcon(icon, 256, 'brand/icon.png')
  await sharp(WORDMARK_SRC)
    .trim({ threshold: 12 })
    .resize({ width: 640, withoutEnlargement: true })
    .png(PNG_OPTS)
    .toFile(resolve(publicDir, 'brand/wordmark.png'))
  console.log('  ✓ brand/wordmark.png')

  console.log('Done.')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
