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

async function roundedIconBuffer(src, size) {
  const base = await sharp(src).resize(size, size, { fit: 'cover' }).toBuffer()
  return sharp(base)
    .composite([{ input: roundedMask(size), blend: 'dest-in' }])
    .png()
    .toBuffer()
}

/** A branded navy panel with a subtle vignette, used for OG + splash art. */
function backdrop(width, height) {
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <defs>
        <radialGradient id="g" cx="50%" cy="38%" r="75%">
          <stop offset="0%" stop-color="#2a1e6e"/>
          <stop offset="60%" stop-color="#140f45"/>
          <stop offset="100%" stop-color="#0d0b3d"/>
        </radialGradient>
      </defs>
      <rect width="${width}" height="${height}" fill="url(#g)"/>
    </svg>`,
  )
}

/** The Open Graph / social sharing card (1200×630): icon + wordmark + tagline. */
async function socialImage(icon) {
  const W = 1200
  const H = 630
  const badge = await roundedIconBuffer(icon, 150)
  const wordmark = await sharp(WORDMARK_SRC)
    .trim({ threshold: 12 })
    .resize({ width: 620, withoutEnlargement: true })
    .png()
    .toBuffer()
  const wm = await sharp(wordmark).metadata()
  const tagline = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
      <text x="50%" y="470" text-anchor="middle" fill="#c9c3f0"
        font-family="Segoe UI, Helvetica, Arial, sans-serif" font-size="34"
        font-weight="500">Keep score for game night — the Flip 7 way.</text>
    </svg>`,
  )
  await sharp(backdrop(W, H))
    .composite([
      { input: badge, top: 96, left: Math.round((W - 150) / 2) },
      {
        input: wordmark,
        top: 280,
        left: Math.round((W - (wm.width ?? 620)) / 2),
      },
      { input: tagline, top: 0, left: 0 },
    ])
    .png(PNG_OPTS)
    .toFile(resolve(publicDir, 'og-image.png'))
  console.log('  ✓ og-image.png')
}

// Portrait launch images for current iPhones (device pixels). Android's splash
// is manifest-driven (background_color + icon), so it needs no image here.
const APPLE_SPLASH = [
  { w: 1320, h: 2868 }, // iPhone 16 Pro Max
  { w: 1290, h: 2796 }, // 15/16 Pro Max, 14 Plus
  { w: 1206, h: 2622 }, // iPhone 16 Pro
  { w: 1179, h: 2556 }, // 14/15 Pro
  { w: 1284, h: 2778 }, // 12/13 Pro Max
  { w: 1170, h: 2532 }, // 12/13/14
  { w: 828, h: 1792 }, // 11 / XR
  { w: 750, h: 1334 }, // SE / 8
]

async function splashImage(icon, width, height) {
  const iconSize = Math.round(Math.min(width, height) * 0.34)
  const badge = await roundedIconBuffer(icon, iconSize)
  const wordmark = await sharp(WORDMARK_SRC)
    .trim({ threshold: 12 })
    .resize({ width: Math.round(width * 0.6), withoutEnlargement: true })
    .png()
    .toBuffer()
  const wm = await sharp(wordmark).metadata()
  await sharp(backdrop(width, height))
    .composite([
      {
        input: badge,
        top: Math.round(height / 2 - iconSize - 24),
        left: Math.round((width - iconSize) / 2),
      },
      {
        input: wordmark,
        top: Math.round(height / 2 + 24),
        left: Math.round((width - (wm.width ?? width * 0.6)) / 2),
      },
    ])
    .png(PNG_OPTS)
    .toFile(resolve(publicDir, `splash-${width}x${height}.png`))
  console.log(`  ✓ splash-${width}x${height}.png`)
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

  // Social sharing + splash screens.
  await socialImage(icon)
  for (const { w, h } of APPLE_SPLASH) await splashImage(icon, w, h)

  console.log('Done.')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
