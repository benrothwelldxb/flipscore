import { INK, SKIN_TONES, shade } from '@/domain/avatar/palette'

/**
 * Pure SVG feature components on a shared 100×100 view box. Every part is a
 * plain function of its props (colour + variant index), so the whole avatar is
 * deterministic and cheap to render. Dark outlines (INK) keep features
 * distinguishable regardless of colour — form, not colour, carries identity.
 */

const stroke = {
  stroke: INK,
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

// ---- Background + shirt ----------------------------------------------------

export function Background({ colour }: { colour: string }) {
  return (
    <>
      <circle cx="50" cy="50" r="50" fill={colour} />
      <circle cx="50" cy="46" r="46" fill={shade(colour, 0.14)} />
    </>
  )
}

export function Shirt({ colour }: { colour: string }) {
  return (
    <g>
      <path
        d="M26 100 C26 84 38 78 50 78 C62 78 74 84 74 100 Z"
        fill={colour}
      />
      <path
        d="M42 79 C45 86 55 86 58 79 L58 82 C54 88 46 88 42 82 Z"
        fill={shade(colour, -0.22)}
      />
    </g>
  )
}

// ---- Shadow + highlight (generic layers) -----------------------------------

export function Shadow() {
  return <ellipse cx="50" cy="76" rx="17" ry="6" fill="rgba(0,0,0,0.10)" />
}

export function Highlight() {
  return <ellipse cx="41" cy="40" rx="9" ry="6" fill="rgba(255,255,255,0.22)" />
}

// ---- Face ------------------------------------------------------------------

export function Face({ tone, shape }: { tone: number; shape: number }) {
  const skin = SKIN_TONES[tone] ?? SKIN_TONES[0]
  const ear = (
    <>
      {[26, 74].map((x) => (
        <circle key={x} cx={x} cy="52" r="6" fill={skin} {...stroke} />
      ))}
    </>
  )
  const neck = (
    <rect
      x="44"
      y="66"
      width="12"
      height="16"
      rx="5"
      fill={shade(skin, -0.08)}
    />
  )
  let head
  switch (shape) {
    case 1:
      head = <ellipse cx="50" cy="47" rx="24" ry="28" fill={skin} {...stroke} />
      break
    case 2:
      head = (
        <rect
          x="26"
          y="22"
          width="48"
          height="50"
          rx="18"
          fill={skin}
          {...stroke}
        />
      )
      break
    case 3:
      head = <ellipse cx="50" cy="48" rx="28" ry="24" fill={skin} {...stroke} />
      break
    default:
      head = <circle cx="50" cy="47" r="26" fill={skin} {...stroke} />
  }
  return (
    <g>
      {ear}
      {neck}
      {head}
    </g>
  )
}

// ---- Eyes ------------------------------------------------------------------

const EYE_X = [38, 62]
const EYE_Y = 47

export function Eyes({ variant }: { variant: number }) {
  return (
    <>
      {EYE_X.map((x) => (
        <Eye key={x} x={x} variant={variant} />
      ))}
    </>
  )
}

function Eye({ x, variant }: { x: number; variant: number }) {
  switch (variant) {
    case 1:
      return (
        <g>
          <circle cx={x} cy={EYE_Y} r="5" fill="#fff" {...stroke} />
          <circle cx={x} cy={EYE_Y} r="2.6" fill={INK} />
        </g>
      )
    case 2:
      return (
        <g>
          <ellipse cx={x} cy={EYE_Y} rx="4" ry="5.2" fill="#fff" {...stroke} />
          <circle cx={x} cy={EYE_Y + 0.5} r="2.4" fill={INK} />
        </g>
      )
    case 3:
      return (
        <path
          d={`M${x - 4} ${EYE_Y - 1} Q${x} ${EYE_Y + 4} ${x + 4} ${EYE_Y - 1}`}
          fill="none"
          {...stroke}
        />
      )
    case 4:
      return (
        <g>
          <circle cx={x} cy={EYE_Y} r="5" fill="#fff" {...stroke} />
          <circle cx={x} cy={EYE_Y} r="2.8" fill={INK} />
          <circle cx={x + 1.4} cy={EYE_Y - 1.4} r="1" fill="#fff" />
        </g>
      )
    default:
      return <circle cx={x} cy={EYE_Y} r="3.4" fill={INK} />
  }
}

/** Bust: dizzy X eyes. */
export function EyesBust() {
  return (
    <>
      {EYE_X.map((x) => (
        <g key={x} {...stroke}>
          <line x1={x - 3.5} y1={EYE_Y - 3.5} x2={x + 3.5} y2={EYE_Y + 3.5} />
          <line x1={x + 3.5} y1={EYE_Y - 3.5} x2={x - 3.5} y2={EYE_Y + 3.5} />
        </g>
      ))}
    </>
  )
}

// ---- Eyebrows --------------------------------------------------------------

export function Eyebrows({ variant }: { variant: number }) {
  const y = 39
  return (
    <>
      {EYE_X.map((x) => {
        switch (variant) {
          case 1:
            return (
              <path
                key={x}
                d={`M${x - 5} ${y} Q${x} ${y - 3} ${x + 5} ${y}`}
                fill="none"
                {...stroke}
              />
            )
          case 2: {
            const tilt = x < 50 ? 1.6 : -1.6
            return (
              <line
                key={x}
                x1={x - 5}
                y1={y + tilt}
                x2={x + 5}
                y2={y - tilt}
                {...stroke}
              />
            )
          }
          default:
            return (
              <line key={x} x1={x - 5} y1={y} x2={x + 5} y2={y} {...stroke} />
            )
        }
      })}
    </>
  )
}

// ---- Mouth -----------------------------------------------------------------

const MOUTH_Y = 62

export function Mouth({ variant }: { variant: number }) {
  switch (variant) {
    case 1:
      return (
        <g>
          <path
            d={`M40 ${MOUTH_Y} Q50 ${MOUTH_Y + 9} 60 ${MOUTH_Y}`}
            fill={INK}
            {...stroke}
          />
          <path
            d={`M43 ${MOUTH_Y + 1.5} Q50 ${MOUTH_Y + 4} 57 ${MOUTH_Y + 1.5}`}
            fill="#fff"
          />
        </g>
      )
    case 2:
      return (
        <line x1="44" y1={MOUTH_Y + 2} x2="56" y2={MOUTH_Y + 2} {...stroke} />
      )
    case 3:
      return (
        <path
          d={`M41 ${MOUTH_Y} Q50 ${MOUTH_Y + 7} 59 ${MOUTH_Y}`}
          fill="none"
          {...stroke}
        />
      )
    case 4:
      return <circle cx="50" cy={MOUTH_Y + 2} r="3.4" fill={INK} {...stroke} />
    case 5:
      return (
        <path
          d={`M44 ${MOUTH_Y + 1} Q50 ${MOUTH_Y + 4} 57 ${MOUTH_Y - 1}`}
          fill="none"
          {...stroke}
        />
      )
    default:
      return (
        <path
          d={`M43 ${MOUTH_Y} Q50 ${MOUTH_Y + 5} 57 ${MOUTH_Y}`}
          fill="none"
          {...stroke}
        />
      )
  }
}

/** Bust: open, dismayed mouth. */
export function MouthBust() {
  return (
    <ellipse
      cx="50"
      cy={MOUTH_Y + 3}
      rx="5"
      ry="4"
      fill="#7a3a3a"
      {...stroke}
    />
  )
}

// ---- Facial hair -----------------------------------------------------------

export function FacialHair({
  variant,
  colour,
}: {
  variant: number
  colour: string
}) {
  if (variant === 0) return null
  switch (variant) {
    case 1: // moustache
      return (
        <path
          d="M40 58 Q45 55 50 58 Q55 55 60 58 Q55 62 50 59 Q45 62 40 58 Z"
          fill={colour}
        />
      )
    case 2: // full beard
      return (
        <path
          d="M28 50 C30 74 42 82 50 82 C58 82 70 74 72 50 C66 60 58 62 50 62 C42 62 34 60 28 50 Z"
          fill={colour}
          opacity="0.95"
        />
      )
    default: // goatee
      return (
        <path
          d="M44 62 Q50 66 56 62 Q54 72 50 74 Q46 72 44 62 Z"
          fill={colour}
        />
      )
  }
}

// ---- Glasses ---------------------------------------------------------------

export function Glasses({ variant }: { variant: number }) {
  if (variant === 0) return null
  const bridge = <line x1="43" y1={EYE_Y} x2="57" y2={EYE_Y} {...stroke} />
  switch (variant) {
    case 2:
      return (
        <g fill="none">
          <rect
            x="31"
            y={EYE_Y - 5}
            width="12"
            height="10"
            rx="3"
            {...stroke}
          />
          <rect
            x="57"
            y={EYE_Y - 5}
            width="12"
            height="10"
            rx="3"
            {...stroke}
          />
          {bridge}
        </g>
      )
    case 3:
      return (
        <g>
          <rect
            x="31"
            y={EYE_Y - 5}
            width="12"
            height="10"
            rx="3"
            fill={INK}
            {...stroke}
          />
          <rect
            x="57"
            y={EYE_Y - 5}
            width="12"
            height="10"
            rx="3"
            fill={INK}
            {...stroke}
          />
          {bridge}
        </g>
      )
    default:
      return (
        <g fill="none">
          <circle cx="37" cy={EYE_Y} r="6.5" {...stroke} />
          <circle cx="63" cy={EYE_Y} r="6.5" {...stroke} />
          {bridge}
        </g>
      )
  }
}

// ---- Hair ------------------------------------------------------------------

export function Hair({ variant, colour }: { variant: number; colour: string }) {
  if (variant === 0) return null
  const dark = shade(colour, -0.15)
  switch (variant) {
    case 1: // short cap
      return (
        <path
          d="M24 46 C24 26 36 20 50 20 C64 20 76 26 76 46 C70 34 60 31 50 31 C40 31 30 34 24 46 Z"
          fill={colour}
          {...stroke}
        />
      )
    case 2: // spiky
      return (
        <path
          d="M25 42 L31 24 L37 36 L44 20 L50 34 L56 20 L63 36 L69 24 L75 42 C66 32 34 32 25 42 Z"
          fill={colour}
          {...stroke}
        />
      )
    case 3: // afro / curly
      return (
        <g fill={colour} {...stroke}>
          <circle cx="50" cy="24" r="17" />
          <circle cx="30" cy="34" r="11" />
          <circle cx="70" cy="34" r="11" />
        </g>
      )
    case 4: // long
      return (
        <path
          d="M22 60 C20 30 34 18 50 18 C66 18 80 30 78 60 C74 46 70 40 68 40 C70 30 62 30 50 30 C38 30 30 30 32 40 C30 40 26 46 22 60 Z"
          fill={colour}
          {...stroke}
        />
      )
    case 5: // side part swoop
      return (
        <path
          d="M25 44 C25 26 38 20 52 20 C66 20 75 28 75 40 C64 30 52 30 44 33 C40 35 34 40 25 44 Z"
          fill={colour}
          {...stroke}
        />
      )
    case 6: // buzz
      return (
        <path
          d="M27 40 C29 28 39 24 50 24 C61 24 71 28 73 40 C64 33 36 33 27 40 Z"
          fill={dark}
          {...stroke}
        />
      )
    default: // top knot
      return (
        <g fill={colour} {...stroke}>
          <circle cx="50" cy="16" r="6" />
          <path d="M26 44 C26 27 37 22 50 22 C63 22 74 27 74 44 C67 34 60 32 50 32 C40 32 33 34 26 44 Z" />
        </g>
      )
  }
}

// ---- Accessories -----------------------------------------------------------

export function Accessory({ variant }: { variant: number }) {
  if (variant === 0) return null
  switch (variant) {
    case 1: // headband
      return (
        <rect
          x="24"
          y="30"
          width="52"
          height="6"
          rx="3"
          fill="#ef4444"
          {...stroke}
        />
      )
    case 2: // bow
      return (
        <g fill="#ec4899" {...stroke}>
          <path d="M64 22 L58 18 L58 26 Z" />
          <path d="M64 22 L70 18 L70 26 Z" />
          <circle cx="64" cy="22" r="2.4" />
        </g>
      )
    case 3: // headphones
      return (
        <g fill="none" {...stroke}>
          <path d="M26 48 C26 26 74 26 74 48" strokeWidth="3" />
          <rect x="22" y="46" width="8" height="12" rx="3" fill="#374151" />
          <rect x="70" y="46" width="8" height="12" rx="3" fill="#374151" />
        </g>
      )
    default: // party hat
      return (
        <g {...stroke}>
          <path d="M50 6 L60 30 L40 30 Z" fill="#f59e0b" />
          <circle cx="50" cy="6" r="2.5" fill="#ef4444" />
        </g>
      )
  }
}

// ---- Crown (leader) --------------------------------------------------------

export function Crown() {
  return (
    <g {...stroke}>
      <path
        d="M34 20 L38 8 L44 16 L50 6 L56 16 L62 8 L66 20 Z"
        fill="#fbbf24"
      />
      <line x1="34" y1="20" x2="66" y2="20" strokeWidth="3" />
      <circle cx="50" cy="6" r="1.6" fill="#fff" />
    </g>
  )
}
