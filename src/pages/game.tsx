import { useEffect } from 'react'
import { Navigate, useParams } from 'react-router'

import { LoadingState } from '@/components/common/screen-state'
import { ConnectedHostPlay } from '@/components/game/connected/connected-host-screen'
import { HostLobby } from '@/components/game/connected/host-lobby'
import { HostScreen } from '@/components/game/host-screen'
import { PassThePhoneScreen } from '@/components/game/pass-the-phone-screen'
import { ResultsScreen } from '@/components/game/results-screen'
import { SetupScreen } from '@/components/game/setup-screen'
import { useGame, useGameStore, useHasHydrated } from '@/stores/game-store'
import { useNetStore } from '@/stores/net-store'

export function GamePage() {
  const { id } = useParams()
  const hydrated = useHasHydrated()
  const game = useGame(id)
  const hosting = useNetStore((s) => s.role === 'hosting' && s.gameId === id)

  useEffect(() => {
    if (id) useGameStore.getState().setActiveGame(id)
  }, [id])

  if (!hydrated) return <LoadingState label="Loading game…" />
  if (!game) return <Navigate to="/" replace />

  const connected = game.settings.mode === 'connected'

  switch (game.status) {
    case 'setup':
      // Connected games swap the roster editor for a lobby once hosting begins.
      if (connected) {
        return hosting ? <HostLobby game={game} /> : <SetupScreen game={game} />
      }
      return <SetupScreen game={game} />
    case 'finished':
      return <ResultsScreen game={game} />
    case 'playing':
      if (game.settings.mode === 'pass')
        return <PassThePhoneScreen game={game} />
      if (connected) return <ConnectedHostPlay game={game} />
      return <HostScreen game={game} />
    default:
      return <Navigate to="/" replace />
  }
}
