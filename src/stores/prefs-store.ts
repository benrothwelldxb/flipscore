import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type ScoreEntryMode = 'manual' | 'cards'

interface PrefsState {
  scoreEntryMode: ScoreEntryMode
  hapticsEnabled: boolean
  soundEnabled: boolean
  /** Opt-in to the experimental Camera Scoring feature (off by default). */
  cameraScoringEnabled: boolean
  setScoreEntryMode: (mode: ScoreEntryMode) => void
  setHapticsEnabled: (enabled: boolean) => void
  setSoundEnabled: (enabled: boolean) => void
  setCameraScoringEnabled: (enabled: boolean) => void
}

export const usePrefsStore = create<PrefsState>()(
  persist(
    (set) => ({
      scoreEntryMode: 'manual',
      hapticsEnabled: true,
      soundEnabled: false,
      cameraScoringEnabled: false,
      setScoreEntryMode: (scoreEntryMode) => set({ scoreEntryMode }),
      setHapticsEnabled: (hapticsEnabled) => set({ hapticsEnabled }),
      setSoundEnabled: (soundEnabled) => set({ soundEnabled }),
      setCameraScoringEnabled: (cameraScoringEnabled) =>
        set({ cameraScoringEnabled }),
    }),
    {
      name: 'flipscore-prefs',
      version: 3,
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as Partial<PrefsState>
        return {
          ...current,
          scoreEntryMode: saved.scoreEntryMode === 'cards' ? 'cards' : 'manual',
          hapticsEnabled:
            typeof saved.hapticsEnabled === 'boolean'
              ? saved.hapticsEnabled
              : true,
          soundEnabled:
            typeof saved.soundEnabled === 'boolean'
              ? saved.soundEnabled
              : false,
          cameraScoringEnabled: saved.cameraScoringEnabled === true,
        }
      },
    },
  ),
)

export const useScoreEntryMode = () => usePrefsStore((s) => s.scoreEntryMode)
export const useHapticsEnabled = () => usePrefsStore((s) => s.hapticsEnabled)
export const useSoundEnabled = () => usePrefsStore((s) => s.soundEnabled)
export const useCameraScoringEnabled = () =>
  usePrefsStore((s) => s.cameraScoringEnabled)
