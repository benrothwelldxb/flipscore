import { useEffect, useState } from 'react'

/** The non-standard `beforeinstallprompt` event (Chromium/Android only). */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function standalone(): boolean {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as { standalone?: boolean }).standalone === true
  )
}

function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false
  return (
    /iphone|ipad|ipod/i.test(navigator.userAgent) &&
    !/crios|fxios/i.test(navigator.userAgent) // iOS A2HS is Safari-only
  )
}

export interface InstallPrompt {
  /** True when the browser has offered a native install prompt we can fire. */
  canPrompt: boolean
  /** Already running as an installed app. */
  isInstalled: boolean
  /** iOS Safari, where install is a manual "Add to Home Screen". */
  isIOS: boolean
  /** Fire the native prompt; resolves to whether the user accepted. */
  promptInstall: () => Promise<boolean>
}

/**
 * Surfaces the platform's install affordance: a native prompt on
 * Chromium/Android, or a signal that iOS needs manual "Add to Home Screen".
 */
export function useInstallPrompt(): InstallPrompt {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(
    null,
  )
  const [isInstalled, setIsInstalled] = useState(standalone())

  useEffect(() => {
    const onPrompt = (event: Event) => {
      event.preventDefault()
      setDeferred(event as BeforeInstallPromptEvent)
    }
    const onInstalled = () => {
      setIsInstalled(true)
      setDeferred(null)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  async function promptInstall(): Promise<boolean> {
    if (!deferred) return false
    await deferred.prompt()
    const { outcome } = await deferred.userChoice
    setDeferred(null)
    if (outcome === 'accepted') setIsInstalled(true)
    return outcome === 'accepted'
  }

  return {
    canPrompt: deferred !== null,
    isInstalled,
    isIOS: isIOS() && !isInstalled,
    promptInstall,
  }
}
