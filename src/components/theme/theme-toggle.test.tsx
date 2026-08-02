import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'

import { useThemeStore } from '@/stores/theme-store'

import { ThemeToggle } from './theme-toggle'

describe('ThemeToggle', () => {
  beforeEach(() => {
    useThemeStore.setState({ theme: 'light', resolvedTheme: 'light' })
  })

  it('renders a labelled control', () => {
    render(<ThemeToggle />)
    expect(
      screen.getByRole('button', { name: /theme: light/i }),
    ).toBeInTheDocument()
  })

  it('cycles light → dark → system → light on click', async () => {
    const user = userEvent.setup()
    render(<ThemeToggle />)
    const button = screen.getByRole('button')

    await user.click(button)
    expect(useThemeStore.getState().theme).toBe('dark')

    await user.click(button)
    expect(useThemeStore.getState().theme).toBe('system')

    await user.click(button)
    expect(useThemeStore.getState().theme).toBe('light')
  })
})
