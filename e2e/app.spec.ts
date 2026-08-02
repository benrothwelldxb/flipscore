import { expect, test } from '@playwright/test'

test.describe('FlipScore shell', () => {
  test('renders the home launcher', async ({ page }) => {
    await page.goto('/')
    await expect(
      page.getByRole('link', { name: 'FlipScore home' }),
    ).toBeVisible()
    await expect(page.getByRole('heading', { name: 'FlipScore' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'New game' })).toBeVisible()
  })

  test('toggles the colour theme', async ({ page }) => {
    await page.goto('/')
    const html = page.locator('html')
    await expect(html).not.toHaveClass(/dark/)
    const toggle = page.getByRole('button', { name: /theme:/i })
    await toggle.click()
    await toggle.click()
    await expect(html).toHaveClass(/dark/)
  })

  test('shows a friendly 404 for unknown routes', async ({ page }) => {
    await page.goto('/does-not-exist')
    await expect(
      page.getByRole('heading', { name: /page not found/i }),
    ).toBeVisible()
    await page.getByRole('link', { name: /back to home/i }).click()
    await expect(page.getByRole('button', { name: 'New game' })).toBeVisible()
  })
})

test.describe('Host Scorekeeper flow', () => {
  test('creates a game, scores a round, and advances', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'New game' }).click()

    await expect(page.getByRole('heading', { name: 'New game' })).toBeVisible()
    await page.getByRole('button', { name: 'Start game' }).click()

    await expect(page.getByRole('heading', { name: /round 1/i })).toBeVisible()

    await page.getByRole('button', { name: 'Enter score for Player 1' }).click()
    await page.getByRole('textbox', { name: 'Score for this round' }).fill('30')
    await page.getByRole('button', { name: 'Save score' }).click()

    await page.getByRole('button', { name: 'Enter score for Player 2' }).click()
    await page.getByRole('textbox', { name: 'Score for this round' }).fill('12')
    await page.getByRole('button', { name: 'Save score' }).click()

    await expect(
      page.getByRole('button', { name: /next round/i }),
    ).toBeEnabled()
  })
})

test.describe('Pass the Phone flow', () => {
  test('passes between players and ends the round', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'New game' }).click()

    await page.getByRole('radio', { name: /Pass the Phone/i }).click()
    await page.getByRole('button', { name: 'Start game' }).click()

    // Player 1 scores.
    await expect(page.getByRole('heading', { name: 'Player 1' })).toBeVisible()
    await page.getByRole('textbox', { name: 'Score for this round' }).fill('15')
    await page.getByRole('button', { name: 'Save & pass' }).click()

    // Handoff screen hides scores and prompts for the next player.
    await page
      .getByRole('button', { name: /pass the phone to player 2/i })
      .click()

    // Player 2 scores.
    await expect(page.getByRole('heading', { name: 'Player 2' })).toBeVisible()
    await page.getByRole('textbox', { name: 'Score for this round' }).fill('8')
    await page.getByRole('button', { name: 'Save & pass' }).click()

    // Round complete → animated standings.
    await expect(
      page.getByRole('heading', { name: /round 1 done/i }),
    ).toBeVisible()
    await expect(
      page.getByRole('button', { name: /start round 2/i }),
    ).toBeVisible()
  })
})
