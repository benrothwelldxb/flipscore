import { cn } from '@/lib/utils'

interface WordmarkProps {
  className?: string
  alt?: string
}

/** The horizontal FlipScorer wordmark lockup (has a light background — place
    it on a light surface). */
export function Wordmark({ className, alt = 'FlipScorer' }: WordmarkProps) {
  return (
    <img
      src="/brand/wordmark.png"
      alt={alt}
      draggable={false}
      className={cn('h-auto w-full object-contain', className)}
    />
  )
}
