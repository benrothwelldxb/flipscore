import { cn } from '@/lib/utils'

interface WordmarkProps {
  className?: string
  alt?: string
}

/** The horizontal FlipScorer wordmark lockup (transparent background with a
    dark outline, so it reads on both light and dark surfaces). */
export function Wordmark({ className, alt = 'FlipScorer' }: WordmarkProps) {
  return (
    <img
      src="/brand/wordmark.png"
      alt={alt}
      width={640}
      height={159}
      draggable={false}
      // The home wordmark is the LCP element — load it eagerly at high priority.
      loading="eager"
      fetchPriority="high"
      className={cn('h-auto w-full object-contain', className)}
    />
  )
}
