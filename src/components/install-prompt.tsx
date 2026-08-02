import { useState } from 'react'
import { Download, Share, SquarePlus, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useInstallPrompt } from '@/hooks/use-install-prompt'

const DISMISS_KEY = 'flipscore-install-dismissed'

function dismissed(): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) === '1'
  } catch {
    return false
  }
}

/**
 * A dismissible "Install FlipScorer" banner. Uses the native install prompt on
 * Chromium/Android; on iOS Safari (which has no prompt) it opens Add-to-Home-
 * Screen instructions. Hidden once installed or dismissed.
 */
export function InstallPrompt() {
  const { canPrompt, isInstalled, isIOS, promptInstall } = useInstallPrompt()
  const [hidden, setHidden] = useState(dismissed())
  const [showIOS, setShowIOS] = useState(false)

  if (isInstalled || hidden || (!canPrompt && !isIOS)) return null

  function dismiss() {
    setHidden(true)
    try {
      localStorage.setItem(DISMISS_KEY, '1')
    } catch {
      /* storage unavailable */
    }
  }

  async function install() {
    if (isIOS) {
      setShowIOS(true)
      return
    }
    const accepted = await promptInstall()
    if (accepted) setHidden(true)
  }

  return (
    <>
      <div className="border-primary/30 bg-primary/5 flex items-center gap-3 rounded-xl border p-3">
        <img
          src="/pwa-192x192.png"
          alt=""
          width={40}
          height={40}
          className="size-10 shrink-0 rounded-lg"
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Install FlipScorer</p>
          <p className="text-muted-foreground text-xs">
            Add it to your home screen for offline, full-screen play.
          </p>
        </div>
        <Button size="sm" onClick={() => void install()}>
          <Download className="size-4" />
          Install
        </Button>
        <button
          type="button"
          aria-label="Dismiss install prompt"
          onClick={dismiss}
          className="text-muted-foreground hover:text-foreground -mr-1 rounded-full p-1"
        >
          <X className="size-4" />
        </button>
      </div>

      <Dialog open={showIOS} onOpenChange={setShowIOS}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add to Home Screen</DialogTitle>
            <DialogDescription>
              Install FlipScorer from Safari in two taps.
            </DialogDescription>
          </DialogHeader>
          <ol className="flex flex-col gap-3 text-sm">
            <li className="flex items-center gap-3">
              <Share className="text-primary size-5 shrink-0" aria-hidden />
              <span>
                Tap the <strong>Share</strong> button in Safari&apos;s toolbar.
              </span>
            </li>
            <li className="flex items-center gap-3">
              <SquarePlus
                className="text-primary size-5 shrink-0"
                aria-hidden
              />
              <span>
                Choose <strong>Add to Home Screen</strong>, then tap{' '}
                <strong>Add</strong>.
              </span>
            </li>
          </ol>
        </DialogContent>
      </Dialog>
    </>
  )
}
