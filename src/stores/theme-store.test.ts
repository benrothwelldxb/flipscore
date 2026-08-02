import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { getSystemTheme, resolveTheme, useThemeStore } from './theme-store'

function mockSystemPrefersDark(prefersDark: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockImplementation((query: string) => ({
      matches: prefersDark,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  )
}

describe('theme store', () => {
  beforeEach(() => {
    useThemeStore.setState({ theme: 'system', resolvedTheme: 'light' })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('defaults to system + light', () => {
    const state = useThemeStore.getState()
    expect(state.theme).toBe('system')
    expect(state.resolvedTheme).toBe('light')
  })

  it('setTheme updates the user choice', () => {
    useThemeStore.getState().setTheme('dark')
    expect(useThemeStore.getState().theme).toBe('dark')
  })

  it('setResolvedTheme updates the applied scheme', () => {
    useThemeStore.getState().setResolvedTheme('dark')
    expect(useThemeStore.getState().resolvedTheme).toBe('dark')
  })
})

describe('getSystemTheme', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('returns dark when the OS prefers dark', () => {
    mockSystemPrefersDark(true)
    expect(getSystemTheme()).toBe('dark')
  })

  it('returns light when the OS prefers light', () => {
    mockSystemPrefersDark(false)
    expect(getSystemTheme()).toBe('light')
  })
})

describe('resolveTheme', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('passes explicit choices through untouched', () => {
    expect(resolveTheme('light')).toBe('light')
    expect(resolveTheme('dark')).toBe('dark')
  })

  it('derives system from the OS preference', () => {
    mockSystemPrefersDark(true)
    expect(resolveTheme('system')).toBe('dark')
  })
})
