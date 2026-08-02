import { STICKERS } from './catalog'
import type { AchievementMetrics, Sticker } from './types'

/** Has this sticker's achievement been earned by the given metrics? */
export function isUnlocked(
  sticker: Sticker,
  metrics: AchievementMetrics,
): boolean {
  return metrics[sticker.achievement.metric] >= sticker.achievement.threshold
}

export interface Progress {
  /** Current metric value, capped at the target. */
  current: number
  /** The threshold to reach. */
  target: number
  /** 0..1 fraction of the way there. */
  ratio: number
}

/** Progress towards a (typically locked) sticker, for a subtle progress hint. */
export function progressOf(
  sticker: Sticker,
  metrics: AchievementMetrics,
): Progress {
  const target = sticker.achievement.threshold
  const raw = metrics[sticker.achievement.metric]
  const current = Math.min(raw, target)
  return { current, target, ratio: target > 0 ? current / target : 1 }
}

/** Ids of every sticker unlocked by the given metrics, in catalog order. */
export function unlockedIds(metrics: AchievementMetrics): string[] {
  return STICKERS.filter((s) => isUnlocked(s, metrics)).map((s) => s.id)
}
