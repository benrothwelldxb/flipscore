import { Monitor, Moon, Sun } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { useSetTheme, useTheme, type Theme } from '@/stores/theme-store'

const ORDER: Theme[] = ['light', 'dark', 'system']
const ICONS = { light: Sun, dark: Moon, system: Monitor } as const
const LABELS = { light: 'Light', dark: 'Dark', system: 'System' } as const

export function ThemeToggle() {
  const theme = useTheme()
  const setTheme = useSetTheme()

  const Icon = ICONS[theme]
  const next = ORDER[(ORDER.indexOf(theme) + 1) % ORDER.length]

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(next)}
      aria-label={`Theme: ${LABELS[theme]}. Switch to ${LABELS[next]}.`}
      title={`Theme: ${LABELS[theme]}`}
    >
      <Icon className="size-5 transition-transform" />
    </Button>
  )
}
