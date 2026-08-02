import { useEffect, type ReactNode } from 'react'

import {
  getSystemTheme,
  resolveTheme,
  useThemeStore,
} from '@/stores/theme-store'

/** Apply the resolved theme to <html>. */
function applyTheme(resolved: 'light' | 'dark') {
  const root = document.documentElement
  root.classList.toggle('dark', resolved === 'dark')
  root.style.colorScheme = resolved
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const theme = useThemeStore((s) => s.theme)
  const setResolvedTheme = useThemeStore((s) => s.setResolvedTheme)

  // Apply whenever the user's choice changes.
  useEffect(() => {
    const resolved = resolveTheme(theme)
    applyTheme(resolved)
    setResolvedTheme(resolved)
  }, [theme, setResolvedTheme])

  // While on "system", follow OS changes live.
  useEffect(() => {
    if (theme !== 'system') return
    const mql = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => {
      const resolved = getSystemTheme()
      applyTheme(resolved)
      setResolvedTheme(resolved)
    }
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [theme, setResolvedTheme])

  return <>{children}</>
}
