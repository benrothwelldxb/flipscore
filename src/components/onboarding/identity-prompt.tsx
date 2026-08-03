import { useMemo, useState } from 'react'
import { UserRound } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { playerNameOptions } from '@/domain/social'
import { cn } from '@/lib/utils'
import { useAllGames } from '@/stores/game-store'
import { useIdentityName, shouldPromptIdentity } from '@/stores/identity-store'
import {
  useIdentityPromptSeen,
  useIntroSeen,
  usePrefsStore,
} from '@/stores/prefs-store'
import { useSocialStore } from '@/stores/social-store'

/**
 * A one-time nudge, shown on the home screen after a first finished game, asking
 * which player is "you". Choosing sets the identity that personalises the
 * Sticker Book and the friends leaderboard (via the unified claimName path).
 */
export function IdentityPrompt() {
  const games = useAllGames()
  const identityName = useIdentityName()
  const seen = useIdentityPromptSeen()
  const introSeen = useIntroSeen()
  const setSeen = usePrefsStore((s) => s.setIdentityPromptSeen)

  // Only after the first-run intro is dismissed, so the two never stack.
  const show = introSeen && shouldPromptIdentity(games, identityName, seen)
  const options = useMemo(() => playerNameOptions(games), [games])
  const [busy, setBusy] = useState(false)

  async function choose(name: string) {
    setBusy(true)
    try {
      // The local identity is set before any network call, so a failed publish
      // (offline / API error) is harmless — swallow it rather than reject.
      await useSocialStore.getState().claimName(name)
    } catch {
      // ignore — claim still took effect locally
    } finally {
      setBusy(false)
      setSeen(true)
    }
  }

  return (
    <Dialog open={show} onOpenChange={(open) => !open && setSeen(true)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserRound className="size-5" aria-hidden />
            Which player is you?
          </DialogTitle>
          <DialogDescription>
            Pick your name so your Sticker Book and leaderboard rank track your
            own games. You can change this any time in the Sticker Book.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap gap-1.5">
          {options.map((name) => (
            <button
              key={name}
              type="button"
              disabled={busy}
              onClick={() => void choose(name)}
              className={cn(
                'focus-visible:ring-ring/50 rounded-full border px-3 py-1.5 text-sm outline-none transition focus-visible:ring-2 disabled:opacity-50',
                'hover:border-primary hover:text-primary',
              )}
            >
              {name}
            </button>
          ))}
        </div>

        <Button variant="ghost" size="sm" onClick={() => setSeen(true)}>
          Not now
        </Button>
      </DialogContent>
    </Dialog>
  )
}
