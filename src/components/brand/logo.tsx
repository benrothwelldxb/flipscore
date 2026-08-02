import { useId } from 'react'

import { cn } from '@/lib/utils'

/** The FlipScore mark: a playful stack of flip-cards. */
export function Logo({
  className,
  decorative = false,
}: {
  className?: string
  /** When adjacent to a text label, mark the mark decorative to avoid a
      duplicated accessible name. */
  decorative?: boolean
}) {
  const gradientId = useId()
  const labelling = decorative
    ? ({ 'aria-hidden': true } as const)
    : ({ role: 'img', 'aria-label': 'FlipScore' } as const)

  return (
    <svg
      viewBox="0 0 512 512"
      className={cn('size-8', className)}
      xmlns="http://www.w3.org/2000/svg"
      {...labelling}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#8b5cf6" />
          <stop offset="1" stopColor="#6366f1" />
        </linearGradient>
      </defs>
      <rect
        x="16"
        y="16"
        width="480"
        height="480"
        rx="112"
        fill={`url(#${gradientId})`}
      />
      <rect
        x="150"
        y="118"
        width="212"
        height="276"
        rx="34"
        fill="#ffffff"
        opacity="0.4"
        transform="rotate(-9 256 256)"
      />
      <rect x="150" y="118" width="212" height="276" rx="34" fill="#ffffff" />
      <line
        x1="150"
        y1="256"
        x2="362"
        y2="256"
        stroke={`url(#${gradientId})`}
        strokeWidth="8"
        strokeDasharray="2 14"
        strokeLinecap="round"
      />
      <circle cx="202" cy="182" r="16" fill="#ef4444" />
      <circle cx="310" cy="330" r="16" fill="#6366f1" />
    </svg>
  )
}
