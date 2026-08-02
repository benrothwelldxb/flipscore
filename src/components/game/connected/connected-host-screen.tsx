import type { Game } from '@/domain/types'

import { HostScreen } from '../host-screen'
import { ConnectionBar } from './connection-bar'

/**
 * The host's authoritative play view for a Connected game: the ordinary host
 * scoreboard (the host can enter or fix any player's score) topped with a live
 * connection strip. Guest scores arrive through the host controller and land in
 * the same store the scoreboard reads, so they simply appear here.
 */
export function ConnectedHostPlay({ game }: { game: Game }) {
  return (
    <div className="flex flex-col gap-4">
      <ConnectionBar game={game} />
      <HostScreen game={game} />
    </div>
  )
}
