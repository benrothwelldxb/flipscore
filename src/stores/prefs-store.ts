import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type ScoreEntryMode = 'manual' | 'cards'

interface PrefsState {
  scoreEntryMode: ScoreEntryMode
  hapticsEnabled: boolean
  soundEnabled: boolean
  /** Opt-in to the experimental Camera Scoring feature (off by default). */
  cameraScoringEnabled: boolean
  /** Whether the first-run "How to play" intro has been shown. */
  introSeen: boolean
  /** Whether the "which player is you?" prompt has been shown. */
  identityPromptSeen: boolean
  setScoreEntryMode: (mode: ScoreEntryMode) => void
  setHapticsEnabled: (enabled: boolean) => void
  setSoundEnabled: (enabled: boolean) => void
  setCameraScoringEnabled: (enabled: boolean) => void
  setIntroSeen: (seen: boolean) => void
  setIdentityPromptSeen: (seen: boolean) => void
}

export const usePrefsStore = create<PrefsState>()(
  persist(
    (set) => ({
      scoreEntryMode: 'manual',
      hapticsEnabled: true,
      soundEnabled: false,
      cameraScoringEnabled: false,
      introSeen: false,
      identityPromptSeen: false,
      setScoreEntryMode: (scoreEntryMode) => set({ scoreEntryMode }),
      setHapticsEnabled: (hapticsEnabled) => set({ hapticsEnabled }),
      setSoundEnabled: (soundEnabled) => set({ soundEnabled }),
      setCameraScoringEnabled: (cameraScoringEnabled) =>
        set({ cameraScoringEnabled }),
      setIntroSeen: (introSeen) => set({ introSeen }),
      setIdentityPromptSeen: (identityPromptSeen) =>
        set({ identityPromptSeen }),
    }),
    {
      name: 'flipscore-prefs',
      version: 4,
      // Hand the stored state straight to `merge` (which tolerantly coerces
      // every field). Without this, a version bump makes persist discard the
      // old state entirely and reset every preference to its default.
      migrate: (persisted) => persisted as PrefsState,
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
          introSeen: saved.introSeen === true,
          identityPromptSeen: saved.identityPromptSeen === true,
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
export const useIntroSeen = () => usePrefsStore((s) => s.introSeen)
export const useIdentityPromptSeen = () =>
  usePrefsStore((s) => s.identityPromptSeen)
