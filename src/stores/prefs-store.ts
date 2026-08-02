import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type ScoreEntryMode = 'manual' | 'cards'

interface PrefsState {
  scoreEntryMode: ScoreEntryMode
  setScoreEntryMode: (mode: ScoreEntryMode) => void
}

export const usePrefsStore = create<PrefsState>()(
  persist(
    (set) => ({
      scoreEntryMode: 'manual',
      setScoreEntryMode: (scoreEntryMode) => set({ scoreEntryMode }),
    }),
    {
      name: 'flipscore-prefs',
      version: 1,
      merge: (persisted, current) => {
        const saved = (persisted as Partial<PrefsState> | undefined)
          ?.scoreEntryMode
        return {
          ...current,
          scoreEntryMode: saved === 'cards' ? 'cards' : 'manual',
        }
      },
    },
  ),
)

export const useScoreEntryMode = () => usePrefsStore((s) => s.scoreEntryMode)
