import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type Theme = 'light' | 'dark' | 'system'
export type ResolvedTheme = 'light' | 'dark'

/** Read the OS-level colour-scheme preference. */
export function getSystemTheme(): ResolvedTheme {
  if (typeof window === 'undefined' || !window.matchMedia) return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light'
}

/** Collapse a Theme choice down to the concrete scheme to render. */
export function resolveTheme(theme: Theme): ResolvedTheme {
  return theme === 'system' ? getSystemTheme() : theme
}

interface ThemeState {
  /** The user's explicit choice. */
  theme: Theme
  /** The concrete scheme currently applied (light or dark). */
  resolvedTheme: ResolvedTheme
  setTheme: (theme: Theme) => void
  /** Set by ThemeProvider once the DOM class has been applied. */
  setResolvedTheme: (theme: ResolvedTheme) => void
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      theme: 'system',
      resolvedTheme: 'light',
      setTheme: (theme) => set({ theme }),
      setResolvedTheme: (resolvedTheme) => set({ resolvedTheme }),
    }),
    {
      name: 'flipscore-theme',
      // Only the user's choice is persisted; the resolved value is derived.
      partialize: (state) => ({ theme: state.theme }),
    },
  ),
)

export const useTheme = () => useThemeStore((s) => s.theme)
export const useResolvedTheme = () => useThemeStore((s) => s.resolvedTheme)
export const useSetTheme = () => useThemeStore((s) => s.setTheme)
