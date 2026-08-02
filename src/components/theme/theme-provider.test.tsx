import { act, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useThemeStore } from '@/stores/theme-store'

import { ThemeProvider } from './theme-provider'

/** A controllable matchMedia fake that can dispatch `change` events. */
function createMatchMedia(initialDark: boolean) {
  let matches = initialDark
  const listeners = new Set<(e: MediaQueryListEvent) => void>()
  const mql = {
    get matches() {
      return matches
    },
    media: '(prefers-color-scheme: dark)',
    onchange: null,
    addEventListener: vi.fn((_: string, cb: (e: MediaQueryListEvent) => void) =>
      listeners.add(cb),
    ),
    removeEventListener: vi.fn(
      (_: string, cb: (e: MediaQueryListEvent) => void) => listeners.delete(cb),
    ),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }
  const fn = vi.fn().mockReturnValue(mql)
  const setDark = (value: boolean) => {
    matches = value
    listeners.forEach((cb) => cb({ matches } as MediaQueryListEvent))
  }
  return { fn, mql, setDark }
}

function renderProvider() {
  return render(
    <ThemeProvider>
      <div>content</div>
    </ThemeProvider>,
  )
}

describe('ThemeProvider', () => {
  beforeEach(() => {
    useThemeStore.setState({ theme: 'system', resolvedTheme: 'light' })
    document.documentElement.classList.remove('dark')
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('applies the dark class for an explicit dark choice', () => {
    vi.stubGlobal('matchMedia', createMatchMedia(false).fn)
    useThemeStore.setState({ theme: 'dark' })
    renderProvider()
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(useThemeStore.getState().resolvedTheme).toBe('dark')
  })

  it('removes the dark class for an explicit light choice', () => {
    vi.stubGlobal('matchMedia', createMatchMedia(true).fn)
    useThemeStore.setState({ theme: 'light' })
    renderProvider()
    expect(document.documentElement.classList.contains('dark')).toBe(false)
    expect(useThemeStore.getState().resolvedTheme).toBe('light')
  })

  it('follows the OS preference while on "system"', () => {
    const media = createMatchMedia(false)
    vi.stubGlobal('matchMedia', media.fn)
    useThemeStore.setState({ theme: 'system' })
    renderProvider()
    expect(document.documentElement.classList.contains('dark')).toBe(false)

    act(() => media.setDark(true))
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(useThemeStore.getState().resolvedTheme).toBe('dark')
  })

  it('unsubscribes from OS changes on unmount', () => {
    const media = createMatchMedia(false)
    vi.stubGlobal('matchMedia', media.fn)
    useThemeStore.setState({ theme: 'system' })
    const { unmount } = renderProvider()
    expect(media.mql.addEventListener).toHaveBeenCalledTimes(1)
    unmount()
    expect(media.mql.removeEventListener).toHaveBeenCalledTimes(1)
  })
})
