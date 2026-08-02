import { colorByKey, initialsFromName, readableTextColor } from './colors'
import type { GameNightSummary } from './game-night'

/**
 * Builds a self-contained SVG "share card" for a Game Night summary. Pure and
 * string-only (initials chips, not avatars) so it rasterises reliably to a PNG
 * via a canvas — no external assets, fonts, or DOM required.
 */

export const SHARE_WIDTH = 1080
export const SHARE_HEIGHT = 1350

const FONT = 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif'
const PLACEMENT = new Set(['champion', 'runner-up', 'wooden-spoon'])

function esc(s: string): string {
  return s.replace(
    /[<>&"']/g,
    (c) =>
      ({
        '<': '&lt;',
        '>': '&gt;',
        '&': '&amp;',
        '"': '&quot;',
        "'": '&#39;',
      })[c] as string,
  )
}

function chip(
  cx: number,
  cy: number,
  r: number,
  colorKey: string,
  name: string,
): string {
  const hex = colorByKey(colorKey).hex
  const ink = readableTextColor(hex)
  return `
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="${hex}"/>
    <text x="${cx}" y="${cy}" font-family="${FONT}" font-size="${r * 0.9}" font-weight="800"
      fill="${ink}" text-anchor="middle" dominant-baseline="central">${esc(initialsFromName(name))}</text>`
}

function text(
  x: number,
  y: number,
  size: number,
  weight: number,
  fill: string,
  anchor: 'start' | 'middle' | 'end',
  content: string,
  spacing = 0,
): string {
  return `<text x="${x}" y="${y}" font-family="${FONT}" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}" letter-spacing="${spacing}">${esc(content)}</text>`
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

/** Serialised SVG string plus its intrinsic dimensions. */
export function buildNightShareSvg(summary: GameNightSummary): string {
  const { night, standings, awards, champion } = summary
  const W = SHARE_WIDTH
  const cx = W / 2
  const gold = '#fbbf24'
  const sub = '#c7d2fe'

  const podium = standings.slice(0, 3)
  const placeLabels = ['1st', '2nd', '3rd']
  const podiumSvg = podium
    .map((s, i) => {
      const x = cx + (i - 1) * 300
      return `
        ${chip(x, 900, i === 0 ? 74 : 60, s.player.color, s.player.name)}
        ${text(x, i === 0 ? 1000 : 985, 34, 700, '#ffffff', 'middle', s.player.name)}
        ${text(x, i === 0 ? 1040 : 1025, 26, 600, gold, 'middle', placeLabels[i])}`
    })
    .join('')

  const funAwards = awards.filter((a) => !PLACEMENT.has(a.key)).slice(0, 6)
  const awardsSvg = funAwards
    .map((a, i) => {
      const col = i % 2
      const row = Math.floor(i / 2)
      const x = 80 + col * 480
      const y = 1074 + row * 72
      return `
        <rect x="${x}" y="${y}" width="440" height="62" rx="16" fill="#ffffff14"/>
        ${text(x + 20, y + 25, 21, 600, sub, 'start', a.title)}
        ${text(x + 20, y + 50, 25, 700, '#ffffff', 'start', a.player.name)}
        ${text(x + 420, y + 40, 25, 800, gold, 'end', a.value)}`
    })
    .join('')

  const dateVenue = night.venue
    ? `${formatDate(night.date)} · ${night.venue}`
    : formatDate(night.date)

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${SHARE_HEIGHT}" viewBox="0 0 ${W} ${SHARE_HEIGHT}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#312e81"/>
      <stop offset="55%" stop-color="#1e1b4b"/>
      <stop offset="100%" stop-color="#0f172a"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${SHARE_HEIGHT}" fill="url(#bg)"/>

  ${text(cx, 96, 30, 800, sub, 'middle', 'FLIPSCORER', 8)}
  ${text(cx, 176, 68, 800, '#ffffff', 'middle', night.name)}
  ${text(cx, 226, 28, 500, sub, 'middle', dateVenue)}

  ${
    champion
      ? `
    <text x="${cx}" y="320" font-family="${FONT}" font-size="26" font-weight="700" fill="${gold}" text-anchor="middle" letter-spacing="4">OVERALL CHAMPION</text>
    ${chip(cx, 470, 120, champion.player.color, champion.player.name)}
    <path d="M${cx - 44} 330 l16 26 26 -34 26 34 16 -26 -12 60 -60 0 z" fill="${gold}"/>
    ${text(cx, 640, 56, 800, '#ffffff', 'middle', champion.player.name)}
    ${text(cx, 690, 30, 600, sub, 'middle', `${champion.wins} ${champion.wins === 1 ? 'win' : 'wins'} · ${summary.gamesPlayed} ${summary.gamesPlayed === 1 ? 'game' : 'games'}`)}`
      : ''
  }

  ${text(cx, 800, 26, 700, sub, 'middle', 'PODIUM', 4)}
  ${podiumSvg}

  ${awardsSvg}

  ${text(cx, 1320, 24, 500, '#94a3b8', 'middle', 'Made with FlipScorer — companion app for Flip 7™')}
</svg>`
}
