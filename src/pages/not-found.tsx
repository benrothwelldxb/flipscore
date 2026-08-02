import { Link } from 'react-router'

import { BrandIcon } from '@/components/brand/brand-icon'
import { Button } from '@/components/ui/button'

export function NotFoundPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 py-24 text-center">
      <BrandIcon className="size-16 rounded-2xl opacity-90" decorative />
      <h1 className="text-2xl font-bold">Page not found</h1>
      <p className="text-muted-foreground max-w-xs text-sm text-balance">
        That card isn&apos;t in the deck. Let&apos;s deal you back in.
      </p>
      <Button asChild>
        <Link to="/">Back to home</Link>
      </Button>
    </div>
  )
}
