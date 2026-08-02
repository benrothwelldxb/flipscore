import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { ArrowLeft } from 'lucide-react'

import { Button } from '@/components/ui/button'

interface PageHeaderProps {
  title: string
  children?: ReactNode
}

export function PageHeader({ title, children }: PageHeaderProps) {
  return (
    <div className="flex items-center gap-2">
      <Button asChild variant="ghost" size="icon" aria-label="Back to home">
        <Link to="/">
          <ArrowLeft className="size-5" />
        </Link>
      </Button>
      <h1 className="flex-1 truncate text-xl font-bold">{title}</h1>
      {children}
    </div>
  )
}
