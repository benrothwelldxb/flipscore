import type { ReactElement } from 'react'

/**
 * Sticker artwork motifs — pure, flat SVG drawn in a 100×100 space and centred
 * to sit on the dark medallion of a {@link StickerArt}. Bold, limited palettes
 * so each reads clearly at album-thumbnail size and as a silhouette when locked.
 * These are intentionally illustrative "placeholders": self-contained vectors,
 * no raster assets, cheap to render dozens at a time.
 */

const WHITE = '#ffffff'
const CREAM = '#fef3c7'
const GOLD = '#fbbf24'
const GOLD_D = '#d97706'
const SILVER = '#e2e8f0'
const SILVER_D = '#94a3b8'
const RED = '#ef4444'
const GREEN = '#22c55e'
const GREEN_D = '#15803d'
const BLUE = '#3b82f6'
const SKY = '#7dd3fc'
const PURPLE = '#a78bfa'
const PINK = '#f472b6'
const ORANGE = '#fb923c'
const BROWN = '#92400e'
const DARK = '#1f2937'
const TEAL = '#2dd4bf'

/** Points of a `points`-pointed star, first tip pointing up. */
function starPath(
  cx: number,
  cy: number,
  outer: number,
  inner: number,
  points = 5,
  rotation = -90,
): string {
  let d = ''
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outer : inner
    const a = (Math.PI / points) * i + (rotation * Math.PI) / 180
    const x = cx + r * Math.cos(a)
    const y = cy + r * Math.sin(a)
    d += `${i === 0 ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)}`
  }
  return `${d}Z`
}

function Star({
  cx,
  cy,
  r,
  fill,
  rotation,
}: {
  cx: number
  cy: number
  r: number
  fill: string
  rotation?: number
}) {
  return <path d={starPath(cx, cy, r, r * 0.45, 5, rotation)} fill={fill} />
}

/** A big bold numeral (used for 7, 50, 100, 777…). */
function Numeral({ text, size = 40 }: { text: string; size?: number }) {
  return (
    <text
      x="50"
      y="53"
      textAnchor="middle"
      dominantBaseline="central"
      fontSize={size}
      fontWeight={800}
      fill={WHITE}
      style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}
    >
      {text}
    </text>
  )
}

const round = {
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const

const MOTIFS: Record<string, () => ReactElement> = {
  trophy: () => (
    <>
      <path
        d="M32 30 C24 30 24 44 34 43"
        fill="none"
        stroke={GOLD}
        strokeWidth={4}
        {...round}
      />
      <path
        d="M68 30 C76 30 76 44 66 43"
        fill="none"
        stroke={GOLD}
        strokeWidth={4}
        {...round}
      />
      <path d="M34 28 H66 L64 44 Q50 58 36 44 Z" fill={GOLD} />
      <rect x="46" y="56" width="8" height="9" fill={GOLD_D} />
      <rect x="40" y="63" width="20" height="6" rx="2" fill={GOLD_D} />
      <Star cx={50} cy={40} r={7} fill={CREAM} />
    </>
  ),

  rosette: () => (
    <>
      <path d="M45 52 L40 72 L49 65 L50 58 Z" fill={BLUE} />
      <path d="M55 52 L60 72 L51 65 L50 58 Z" fill={RED} />
      <circle cx="50" cy="44" r="17" fill={GOLD} />
      <circle cx="50" cy="44" r="11" fill={RED} />
      <Star cx={50} cy={44} r={7} fill={WHITE} />
    </>
  ),

  medal: () => (
    <>
      <path d="M40 24 L34 32 L46 48 L54 40 Z" fill={BLUE} />
      <path d="M60 24 L66 32 L54 48 L46 40 Z" fill={RED} />
      <circle cx="50" cy="56" r="16" fill={GOLD} />
      <circle cx="50" cy="56" r="11" fill={GOLD_D} />
      <Star cx={50} cy={56} r={7} fill={CREAM} />
    </>
  ),

  crown: () => (
    <>
      <path
        d="M30 62 L34 36 L43 50 L50 32 L57 50 L66 36 L70 62 Z"
        fill={GOLD}
        stroke={GOLD_D}
        strokeWidth={2}
        {...round}
      />
      <rect x="32" y="62" width="36" height="7" rx="2" fill={GOLD_D} />
      <circle cx="50" cy="47" r="3" fill={RED} />
      <circle cx="37" cy="52" r="2.5" fill={SKY} />
      <circle cx="63" cy="52" r="2.5" fill={SKY} />
    </>
  ),

  'crown-star': () => (
    <>
      <Star cx={50} cy={30} r={9} fill={CREAM} />
      <path
        d="M30 64 L34 42 L43 54 L50 40 L57 54 L66 42 L70 64 Z"
        fill={GOLD}
        stroke={GOLD_D}
        strokeWidth={2}
        {...round}
      />
      <rect x="32" y="64" width="36" height="7" rx="2" fill={GOLD_D} />
      <circle cx="50" cy="55" r="3" fill={PINK} />
    </>
  ),

  'double-trophy': () => (
    <>
      <path d="M28 32 H46 L44 44 Q37 52 30 44 Z" fill={GOLD} />
      <rect x="34" y="52" width="6" height="7" fill={GOLD_D} />
      <rect x="29" y="58" width="16" height="5" rx="2" fill={GOLD_D} />
      <path d="M54 32 H72 L70 44 Q63 52 56 44 Z" fill={CREAM} />
      <rect x="60" y="52" width="6" height="7" fill={GOLD_D} />
      <rect x="55" y="58" width="16" height="5" rx="2" fill={GOLD_D} />
    </>
  ),

  flame: () => (
    <>
      <path
        d="M50 24 C64 40 68 48 62 60 A14 14 0 1 1 38 60 C34 50 44 46 46 40 C48 46 52 44 50 24 Z"
        fill={ORANGE}
      />
      <path
        d="M50 40 C58 50 58 56 54 62 A8 8 0 1 1 44 60 C42 52 48 50 50 40 Z"
        fill={GOLD}
      />
    </>
  ),

  target: () => (
    <>
      <circle cx="47" cy="53" r="19" fill={RED} />
      <circle cx="47" cy="53" r="13" fill={WHITE} />
      <circle cx="47" cy="53" r="7" fill={RED} />
      <circle cx="47" cy="53" r="2.5" fill={WHITE} />
      <path
        d="M47 53 L74 30"
        stroke={DARK}
        strokeWidth={4}
        fill="none"
        {...round}
      />
      <path d="M74 30 L64 31 L70 37 Z" fill={GREEN} />
    </>
  ),

  fifty: () => <Numeral text="50" size={42} />,
  hundred: () => <Numeral text="100" size={30} />,
  seven: () => <Numeral text="7" size={48} />,
  sevens: () => <Numeral text="777" size={26} />,

  'seven-star': () => (
    <>
      <Star cx={50} cy={50} r={26} fill={GOLD} rotation={-90} />
      <Numeral text="7" size={30} />
    </>
  ),

  coins: () => (
    <>
      <ellipse cx="50" cy="62" rx="20" ry="7" fill={GOLD_D} />
      <rect x="30" y="50" width="40" height="12" fill={GOLD} />
      <ellipse cx="50" cy="50" rx="20" ry="7" fill={GOLD_D} />
      <rect x="34" y="38" width="32" height="12" fill={GOLD} />
      <ellipse cx="50" cy="38" rx="16" ry="6" fill={CREAM} />
      <text
        x="50"
        y="39"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize="12"
        fontWeight={800}
        fill={GOLD_D}
        style={{ fontFamily: 'system-ui, sans-serif' }}
      >
        $
      </text>
    </>
  ),

  'gem-dice': () => (
    <>
      <rect
        x="26"
        y="40"
        width="26"
        height="26"
        rx="6"
        fill={WHITE}
        transform="rotate(-12 39 53)"
      />
      <rect
        x="48"
        y="34"
        width="26"
        height="26"
        rx="6"
        fill={SILVER}
        transform="rotate(10 61 47)"
      />
      <circle cx="35" cy="49" r="2.6" fill={DARK} />
      <circle cx="43" cy="57" r="2.6" fill={DARK} />
      <circle cx="57" cy="42" r="2.6" fill={RED} />
      <circle cx="61" cy="47" r="2.6" fill={RED} />
      <circle cx="65" cy="52" r="2.6" fill={RED} />
    </>
  ),

  mountain: () => (
    <>
      <circle cx="66" cy="34" r="7" fill={GOLD} />
      <path d="M26 68 L45 36 L57 54 L64 43 L74 68 Z" fill={BLUE} />
      <path d="M45 36 L51 46 L45 50 L39 46 Z" fill={WHITE} />
      <path d="M64 43 L69 51 L64 53 L59 51 Z" fill={WHITE} />
    </>
  ),

  die: () => (
    <>
      <rect
        x="30"
        y="32"
        width="40"
        height="40"
        rx="9"
        fill={WHITE}
        transform="rotate(-8 50 52)"
      />
      <g transform="rotate(-8 50 52)">
        <circle cx="40" cy="42" r="3.2" fill={DARK} />
        <circle cx="60" cy="42" r="3.2" fill={DARK} />
        <circle cx="50" cy="52" r="3.2" fill={RED} />
        <circle cx="40" cy="62" r="3.2" fill={DARK} />
        <circle cx="60" cy="62" r="3.2" fill={DARK} />
      </g>
    </>
  ),

  parachute: () => (
    <>
      <path d="M26 46 A24 24 0 0 1 74 46 Z" fill={RED} />
      <path d="M42 46 A24 24 0 0 1 58 46 Z" fill={WHITE} />
      <path d="M26 46 A24 24 0 0 1 42 46" fill={GOLD} />
      <path d="M58 46 A24 24 0 0 1 74 46" fill={GOLD} />
      <path
        d="M28 46 L48 64 M50 46 L50 64 M72 46 L52 64"
        stroke={DARK}
        strokeWidth={2}
        {...round}
      />
      <rect x="44" y="63" width="12" height="8" rx="2" fill={BROWN} />
    </>
  ),

  skull: () => (
    <>
      <path
        d="M32 46 A18 18 0 0 1 68 46 V56 A8 8 0 0 1 60 64 H58 V70 H42 V64 H40 A8 8 0 0 1 32 56 Z"
        fill={WHITE}
      />
      <circle cx="42" cy="49" r="5" fill={DARK} />
      <circle cx="58" cy="49" r="5" fill={DARK} />
      <path d="M50 55 L46 61 H54 Z" fill={DARK} />
      <path
        d="M45 70 V64 M50 70 V64 M55 70 V64"
        stroke={SILVER_D}
        strokeWidth={2}
      />
    </>
  ),

  bomb: () => (
    <>
      <circle cx="47" cy="58" r="17" fill={DARK} />
      <circle cx="41" cy="52" r="4" fill={SILVER_D} />
      <rect
        x="52"
        y="34"
        width="8"
        height="8"
        rx="2"
        fill={SILVER_D}
        transform="rotate(20 56 38)"
      />
      <path
        d="M58 36 C66 30 62 24 68 22"
        fill="none"
        stroke={GOLD_D}
        strokeWidth={3}
        {...round}
      />
      <Star cx={70} cy={20} r={6} fill={ORANGE} />
    </>
  ),

  chips: () => (
    <>
      <ellipse cx="50" cy="60" rx="18" ry="6" fill={RED} />
      <rect x="32" y="50" width="36" height="10" fill={RED} />
      <ellipse cx="50" cy="50" rx="18" ry="6" fill={BLUE} />
      <rect x="32" y="42" width="36" height="8" fill={BLUE} />
      <ellipse cx="50" cy="42" rx="18" ry="6" fill={GREEN} />
      <ellipse cx="50" cy="42" rx="9" ry="3" fill={WHITE} />
    </>
  ),

  clover: () => (
    <>
      <path d="M50 50 L44 68 H56 Z" fill={GREEN_D} />
      <circle cx="50" cy="38" r="9" fill={GREEN} />
      <circle cx="38" cy="50" r="9" fill={GREEN} />
      <circle cx="62" cy="50" r="9" fill={GREEN} />
      <circle cx="50" cy="52" r="9" fill={GREEN} />
      <circle cx="50" cy="46" r="3" fill={GREEN_D} />
    </>
  ),

  ribbon: () => (
    <>
      <path d="M38 28 V72" stroke={DARK} strokeWidth={3} {...round} />
      <rect x="40" y="28" width="26" height="20" fill={WHITE} />
      <g fill={DARK}>
        <rect x="40" y="28" width="6.5" height="6.6" />
        <rect x="53" y="28" width="6.5" height="6.6" />
        <rect x="46.5" y="34.6" width="6.5" height="6.6" />
        <rect x="59.5" y="34.6" width="6.5" height="6.6" />
        <rect x="40" y="41.2" width="6.5" height="6.8" />
        <rect x="53" y="41.2" width="6.5" height="6.8" />
      </g>
    </>
  ),

  balance: () => (
    <>
      <path d="M50 28 V64" stroke={GOLD} strokeWidth={3} {...round} />
      <path d="M30 34 H70" stroke={GOLD} strokeWidth={3} {...round} />
      <circle cx="50" cy="30" r="3" fill={GOLD} />
      <path d="M30 34 L23 48 H37 Z" fill={SKY} />
      <path d="M70 34 L63 48 H77 Z" fill={SKY} />
      <path
        d="M30 34 V34 M23 48 A7 7 0 0 0 37 48"
        stroke={GOLD}
        strokeWidth={2}
        fill="none"
      />
      <rect x="40" y="64" width="20" height="5" rx="2" fill={GOLD_D} />
    </>
  ),

  rising: () => (
    <>
      <rect x="30" y="54" width="9" height="14" rx="1.5" fill={GREEN_D} />
      <rect x="45" y="46" width="9" height="22" rx="1.5" fill={GREEN} />
      <rect x="60" y="36" width="9" height="32" rx="1.5" fill={TEAL} />
      <path
        d="M30 50 L48 40 L58 44 L72 28"
        stroke={WHITE}
        strokeWidth={3}
        fill="none"
        {...round}
      />
      <path d="M72 28 L62 28 L69 35 Z" fill={WHITE} />
    </>
  ),

  phoenix: () => (
    <>
      <path d="M50 30 C40 42 30 40 24 34 C34 52 44 48 50 44 Z" fill={ORANGE} />
      <path d="M50 30 C60 42 70 40 76 34 C66 52 56 48 50 44 Z" fill={GOLD} />
      <path d="M50 40 C56 50 54 60 50 70 C46 60 44 50 50 40 Z" fill={RED} />
      <circle cx="50" cy="34" r="3" fill={DARK} />
    </>
  ),

  ice: () => (
    <>
      <g stroke={SKY} strokeWidth={3} {...round}>
        <path d="M50 24 V76" />
        <path d="M28 37 L72 63" />
        <path d="M72 37 L28 63" />
        <path d="M50 32 L44 38 M50 32 L56 38" />
        <path d="M50 68 L44 62 M50 68 L56 62" />
        <path d="M33 40 L34 48 M33 40 L41 41" />
        <path d="M67 60 L66 52 M67 60 L59 59" />
        <path d="M67 40 L66 48 M67 40 L59 41" />
        <path d="M33 60 L34 52 M33 60 L41 59" />
      </g>
      <circle cx="50" cy="50" r="4" fill={WHITE} />
    </>
  ),

  gem: () => (
    <>
      <path d="M36 38 H64 L74 48 L50 74 L26 48 Z" fill={TEAL} />
      <path d="M36 38 L42 48 H26 Z" fill={SKY} />
      <path d="M64 38 L58 48 H74 Z" fill={SKY} />
      <path d="M42 48 H58 L50 74 Z" fill={WHITE} opacity={0.85} />
      <path d="M36 38 L42 48 H58 L64 38 Z" fill={SKY} opacity={0.6} />
    </>
  ),

  phone: () => (
    <>
      <path
        d="M28 40 A22 22 0 0 1 72 40"
        fill="none"
        stroke={GOLD}
        strokeWidth={3}
        {...round}
      />
      <path
        d="M72 40 L66 34 M72 40 L78 34"
        stroke={GOLD}
        strokeWidth={3}
        fill="none"
        {...round}
      />
      <rect x="40" y="34" width="20" height="34" rx="5" fill={WHITE} />
      <rect x="43" y="39" width="14" height="20" rx="2" fill={BLUE} />
      <circle cx="50" cy="63" r="2.5" fill={SILVER_D} />
    </>
  ),

  link: () => (
    <>
      <rect x="30" y="40" width="18" height="30" rx="4" fill={WHITE} />
      <rect x="52" y="40" width="18" height="30" rx="4" fill={SILVER} />
      <g stroke={GREEN} strokeWidth={3} fill="none" {...round}>
        <path d="M42 34 A10 10 0 0 1 58 34" />
        <path d="M37 28 A18 18 0 0 1 63 28" />
      </g>
      <circle cx="50" cy="38" r="2.5" fill={GREEN} />
    </>
  ),

  people: () => (
    <>
      <circle cx="32" cy="44" r="8" fill={BLUE} />
      <path d="M20 70 A12 12 0 0 1 44 70 Z" fill={BLUE} />
      <circle cx="68" cy="44" r="8" fill={RED} />
      <path d="M56 70 A12 12 0 0 1 80 70 Z" fill={RED} />
      <circle cx="50" cy="40" r="10" fill={GOLD} />
      <path d="M36 72 A14 14 0 0 1 64 72 Z" fill={GOLD} />
    </>
  ),

  confetti: () => (
    <>
      <path d="M26 74 L38 44 L56 62 Z" fill={GOLD} />
      <path d="M26 74 L38 44 L47 53 Z" fill={GOLD_D} />
      <circle cx="60" cy="34" r="3.5" fill={RED} />
      <rect
        x="66"
        y="44"
        width="6"
        height="6"
        rx="1"
        fill={BLUE}
        transform="rotate(20 69 47)"
      />
      <path d="M52 28 l4 4 -4 4 -4 -4 Z" fill={GREEN} />
      <circle cx="72" cy="30" r="3" fill={PINK} />
      <rect x="58" y="50" width="5" height="5" rx="1" fill={PURPLE} />
    </>
  ),

  antenna: () => (
    <>
      <path d="M42 68 L48 40 H52 L58 68 Z" fill={SILVER_D} />
      <path d="M44 58 H56" stroke={DARK} strokeWidth={2} />
      <circle cx="50" cy="38" r="4" fill={RED} />
      <g stroke={SKY} strokeWidth={3} fill="none" {...round}>
        <path d="M40 32 A14 14 0 0 0 40 46" />
        <path d="M60 32 A14 14 0 0 1 60 46" />
        <path d="M34 26 A22 22 0 0 0 34 52" />
        <path d="M66 26 A22 22 0 0 1 66 52" />
      </g>
    </>
  ),

  globe: () => (
    <>
      <circle cx="50" cy="50" r="24" fill={BLUE} />
      <path d="M38 34 C30 44 30 56 38 66" fill={GREEN} opacity={0.9} />
      <path
        d="M56 36 C68 40 66 54 58 60 C64 50 58 44 56 36 Z"
        fill={GREEN}
        opacity={0.9}
      />
      <g stroke={WHITE} strokeWidth={1.5} fill="none" opacity={0.7}>
        <ellipse cx="50" cy="50" rx="10" ry="24" />
        <path d="M26 50 H74" />
        <path d="M30 38 H70 M30 62 H70" />
      </g>
    </>
  ),

  flag: () => (
    <>
      <path d="M40 26 V74" stroke={BROWN} strokeWidth={3} {...round} />
      <path d="M40 28 L68 36 L40 46 Z" fill={RED} />
      <path d="M30 74 H54" stroke={GREEN_D} strokeWidth={3} {...round} />
      <circle cx="40" cy="26" r="3" fill={GOLD} />
    </>
  ),

  cards: () => (
    <>
      <rect
        x="34"
        y="38"
        width="24"
        height="32"
        rx="4"
        fill={WHITE}
        transform="rotate(-16 46 54)"
      />
      <rect
        x="40"
        y="34"
        width="24"
        height="32"
        rx="4"
        fill={WHITE}
        transform="rotate(-2 52 50)"
      />
      <rect
        x="46"
        y="36"
        width="24"
        height="32"
        rx="4"
        fill={WHITE}
        transform="rotate(12 58 52)"
      />
      <path
        d="M58 46 a4 4 0 0 1 8 0 c0 4 -4 5 -4 9 c0 -4 -4 -5 -4 -9 Z"
        fill={RED}
      />
    </>
  ),

  track: () => (
    <>
      <rect x="46" y="22" width="8" height="5" rx="2" fill={SILVER_D} />
      <path d="M50 27 V32" stroke={SILVER_D} strokeWidth={3} />
      <circle cx="50" cy="54" r="20" fill={WHITE} />
      <circle
        cx="50"
        cy="54"
        r="20"
        fill="none"
        stroke={SILVER_D}
        strokeWidth={3}
      />
      <g stroke={DARK} strokeWidth={2}>
        <path d="M50 38 V42 M50 66 V70 M34 54 H38 M62 54 H66" />
      </g>
      <path
        d="M50 54 L50 42 M50 54 L60 58"
        stroke={RED}
        strokeWidth={3}
        fill="none"
        {...round}
      />
      <circle cx="50" cy="54" r="3" fill={RED} />
    </>
  ),

  deckchair: () => (
    <>
      <circle cx="66" cy="32" r="7" fill={GOLD} />
      <path d="M28 40 A22 22 0 0 1 72 40 Z" fill={RED} />
      <path d="M28 40 A22 22 0 0 1 50 34 V40 Z" fill={WHITE} />
      <path d="M50 34 A22 22 0 0 1 72 40 H50 Z" fill={WHITE} opacity={0.5} />
      <path d="M50 40 V70" stroke={BROWN} strokeWidth={3} {...round} />
      <path d="M40 70 H60" stroke={BROWN} strokeWidth={3} {...round} />
    </>
  ),

  moon: () => (
    <>
      <path d="M62 26 A24 24 0 1 0 62 74 A19 19 0 0 1 62 26 Z" fill={CREAM} />
      <Star cx={40} cy={34} r={4} fill={WHITE} />
      <Star cx={34} cy={58} r={3} fill={WHITE} />
      <circle cx="55" cy="40" r="3" fill={SILVER_D} opacity={0.5} />
      <circle cx="50" cy="58" r="4" fill={SILVER_D} opacity={0.5} />
    </>
  ),

  sun: () => (
    <>
      <g stroke={GOLD} strokeWidth={4} {...round}>
        <path d="M50 22 V30 M50 70 V78 M22 50 H30 M70 50 H78" />
        <path d="M31 31 L36 36 M69 31 L64 36 M31 69 L36 64 M69 69 L64 64" />
      </g>
      <circle cx="50" cy="50" r="15" fill={GOLD} />
      <circle
        cx="50"
        cy="50"
        r="15"
        fill="none"
        stroke={GOLD_D}
        strokeWidth={2}
      />
    </>
  ),

  tree: () => (
    <>
      <Star cx={50} cy={24} r={6} fill={GOLD} />
      <path d="M50 30 L38 46 H62 Z" fill={GREEN} />
      <path d="M50 40 L34 58 H66 Z" fill={GREEN_D} />
      <rect x="46" y="58" width="8" height="10" fill={BROWN} />
      <circle cx="44" cy="43" r="2.5" fill={RED} />
      <circle cx="56" cy="52" r="2.5" fill={GOLD} />
      <circle cx="46" cy="54" r="2.5" fill={SKY} />
    </>
  ),

  fireworks: () => (
    <>
      <g stroke={GOLD} strokeWidth={3} {...round}>
        <path d="M50 50 V28 M50 50 V72 M50 50 H28 M50 50 H72" />
        <path d="M50 50 L35 35 M50 50 L65 35 M50 50 L35 65 M50 50 L65 65" />
      </g>
      <circle cx="50" cy="28" r="3" fill={RED} />
      <circle cx="72" cy="50" r="3" fill={SKY} />
      <circle cx="50" cy="72" r="3" fill={GREEN} />
      <circle cx="28" cy="50" r="3" fill={PINK} />
      <circle cx="35" cy="35" r="2.5" fill={PURPLE} />
      <circle cx="65" cy="35" r="2.5" fill={GOLD} />
      <circle cx="50" cy="50" r="4" fill={WHITE} />
    </>
  ),
}

/** Render a motif by key, falling back to a neutral star for unknown ids. */
export function Motif({ art }: { art: string }): ReactElement {
  const render = MOTIFS[art]
  if (render) return render()
  return <Star cx={50} cy={50} r={22} fill={WHITE} />
}

/** The set of art keys the registry can render (used to validate the catalog).
 *  Co-located with the registry it describes. */
// eslint-disable-next-line react-refresh/only-export-components
export const MOTIF_KEYS = Object.keys(MOTIFS)
