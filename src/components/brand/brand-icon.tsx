import { cn } from '@/lib/utils'

interface BrandIconProps {
  className?: string
  /** When paired with adjacent text, mark the icon decorative. */
  decorative?: boolean
}

/** The FlipScorer app icon (self-contained artwork on its navy badge). */
export function BrandIcon({ className, decorative = false }: BrandIconProps) {
  return (
    <img
      src="/brand/icon.png"
      width={256}
      height={256}
      alt={decorative ? '' : 'FlipScorer'}
      aria-hidden={decorative || undefined}
      draggable={false}
      className={cn('size-8 object-contain', className)}
    />
  )
}
