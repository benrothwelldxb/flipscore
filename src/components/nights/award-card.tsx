import {
  Bomb,
  Clover,
  Flame,
  Medal,
  Rocket,
  Ruler,
  Target,
  TrendingUp,
  Trophy,
  Utensils,
  type LucideIcon,
} from 'lucide-react'

import { PlayerAvatar } from '@/components/game/player-avatar'
import type { AwardKey, NightAward } from '@/domain/game-night'
import { cn } from '@/lib/utils'

const ICONS: Record<AwardKey, LucideIcon> = {
  champion: Trophy,
  'runner-up': Medal,
  'wooden-spoon': Utensils,
  'highest-round': TrendingUp,
  'most-busts': Bomb,
  luckiest: Clover,
  'most-aggressive': Flame,
  'most-consistent': Ruler,
  comeback: Rocket,
  'best-average-finish': Target,
}

/** A single trophy-cabinet card for one Game Night award. */
export function AwardCard({
  award,
  className,
}: {
  award: NightAward
  className?: string
}) {
  const Icon = ICONS[award.key] ?? Trophy
  return (
    <div
      className={cn(
        'bg-card flex flex-col gap-2 rounded-xl border p-3',
        className,
      )}
    >
      <div className="text-muted-foreground flex items-center gap-1.5 text-xs font-semibold">
        <Icon className="text-primary size-4" aria-hidden />
        <span className="truncate">{award.title}</span>
      </div>
      <div className="flex items-center gap-2">
        <PlayerAvatar
          name={award.player.name}
          color={award.player.color}
          avatar={award.player.avatar}
          size={32}
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{award.player.name}</p>
          <p className="text-muted-foreground truncate text-[11px]">
            {award.caption}
          </p>
        </div>
        <span className="shrink-0 text-sm font-bold tabular-nums">
          {award.value}
        </span>
      </div>
    </div>
  )
}
