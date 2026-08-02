import { useRef, type KeyboardEvent } from 'react'
import { Monitor, Moon, Settings, Sun, type LucideIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { vibrate } from '@/lib/haptics'
import { playSound } from '@/lib/sound'
import { cn } from '@/lib/utils'
import {
  useHapticsEnabled,
  usePrefsStore,
  useSoundEnabled,
} from '@/stores/prefs-store'
import { useSetTheme, useTheme, type Theme } from '@/stores/theme-store'

const THEMES: { key: Theme; label: string; icon: LucideIcon }[] = [
  { key: 'light', label: 'Light', icon: Sun },
  { key: 'dark', label: 'Dark', icon: Moon },
  { key: 'system', label: 'System', icon: Monitor },
]

export function SettingsDialog() {
  const theme = useTheme()
  const setTheme = useSetTheme()
  const haptics = useHapticsEnabled()
  const sound = useSoundEnabled()
  const setHaptics = usePrefsStore((s) => s.setHapticsEnabled)
  const setSound = usePrefsStore((s) => s.setSoundEnabled)
  const themeRefs = useRef<(HTMLButtonElement | null)[]>([])

  function handleThemeKey(event: KeyboardEvent, index: number) {
    const forward = event.key === 'ArrowRight' || event.key === 'ArrowDown'
    const back = event.key === 'ArrowLeft' || event.key === 'ArrowUp'
    if (!forward && !back) return
    event.preventDefault()
    const next = (index + (forward ? 1 : -1) + THEMES.length) % THEMES.length
    setTheme(THEMES[next].key)
    themeRefs.current[next]?.focus()
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Settings">
          <Settings className="size-5" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription className="sr-only">
            App appearance and feedback preferences.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-5">
          <div className="space-y-2">
            <Label>Appearance</Label>
            <div
              role="radiogroup"
              aria-label="Theme"
              className="bg-muted grid grid-cols-3 gap-1 rounded-lg p-1"
            >
              {THEMES.map(({ key, label, icon: Icon }, index) => {
                const active = theme === key
                return (
                  <button
                    key={key}
                    ref={(el) => {
                      themeRefs.current[index] = el
                    }}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    tabIndex={active ? 0 : -1}
                    onKeyDown={(event) => handleThemeKey(event, index)}
                    onClick={() => setTheme(key)}
                    className={cn(
                      'flex h-9 items-center justify-center gap-1.5 rounded-md text-sm font-medium outline-none transition focus-visible:ring-2 focus-visible:ring-ring/50',
                      active
                        ? 'bg-background text-foreground shadow-sm'
                        : 'text-muted-foreground',
                    )}
                  >
                    <Icon className="size-4" aria-hidden />
                    {label}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="flex items-center justify-between gap-4">
            <Label
              htmlFor="sound-toggle"
              className="flex-col items-start gap-0.5"
            >
              Sound effects
              <span className="text-muted-foreground text-xs font-normal">
                Subtle taps and a winner fanfare
              </span>
            </Label>
            <Switch
              id="sound-toggle"
              checked={sound}
              onCheckedChange={(value) => {
                setSound(value)
                if (value) playSound('save')
              }}
            />
          </div>

          <div className="flex items-center justify-between gap-4">
            <Label
              htmlFor="haptics-toggle"
              className="flex-col items-start gap-0.5"
            >
              Haptics
              <span className="text-muted-foreground text-xs font-normal">
                Vibration feedback on supported devices
              </span>
            </Label>
            <Switch
              id="haptics-toggle"
              checked={haptics}
              onCheckedChange={(value) => {
                setHaptics(value)
                if (value) vibrate(20)
              }}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
