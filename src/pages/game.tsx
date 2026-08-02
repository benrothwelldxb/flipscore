import { useEffect } from 'react'
import { Navigate, useParams } from 'react-router'

import { LoadingState } from '@/components/common/screen-state'
import { HostScreen } from '@/components/game/host-screen'
import { PassThePhoneScreen } from '@/components/game/pass-the-phone-screen'
import { ResultsScreen } from '@/components/game/results-screen'
import { SetupScreen } from '@/components/game/setup-screen'
import { useGame, useGameStore, useHasHydrated } from '@/stores/game-store'

export function GamePage() {
  const { id } = useParams()
  const hydrated = useHasHydrated()
  const game = useGame(id)

  useEffect(() => {
    if (id) useGameStore.getState().setActiveGame(id)
  }, [id])

  if (!hydrated) return <LoadingState label="Loading game…" />
  if (!game) return <Navigate to="/" replace />

  switch (game.status) {
    case 'setup':
      return <SetupScreen game={game} />
    case 'finished':
      return <ResultsScreen game={game} />
    case 'playing':
      return game.settings.mode === 'pass' ? (
        <PassThePhoneScreen game={game} />
      ) : (
        <HostScreen game={game} />
      )
    default:
      return <Navigate to="/" replace />
  }
}
