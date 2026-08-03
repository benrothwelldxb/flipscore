import { expect, test } from '@playwright/test'

// Mark onboarding as already-seen so the first-run "How to play" dialog and the
// "which player is you?" prompt don't sit over the UI these tests drive.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      'flipscore-prefs',
      JSON.stringify({
        state: { introSeen: true, identityPromptSeen: true },
        version: 4,
      }),
    )
  })
})

test.describe('FlipScore shell', () => {
  test('renders the home launcher', async ({ page }) => {
    await page.goto('/')
    await expect(
      page.getByRole('link', { name: 'FlipScorer home' }),
    ).toBeVisible()
    await expect(
      page.getByRole('heading', { name: 'FlipScorer' }),
    ).toBeVisible()
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

test.describe('Card Builder', () => {
  test('computes a Flip 7 score from selected cards and saves it', async ({
    page,
  }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'New game' }).click()
    await page.getByRole('button', { name: 'Start game' }).click()

    await page.getByRole('button', { name: 'Enter score for Player 1' }).click()
    await page.getByRole('button', { name: 'Card Builder' }).click()

    // 1..7 unique cards → 28, plus the Flip 7 bonus of 15 → 43.
    for (const n of [1, 2, 3, 4, 5, 6, 7]) {
      await page
        .getByRole('button', { name: `Number card ${n}`, exact: true })
        .click()
    }
    await expect(page.getByLabel('Round score 43')).toBeVisible()

    await page.getByRole('button', { name: 'Save score' }).click()

    // Player 1's row now shows the computed 43.
    await expect(
      page.getByRole('button', { name: /currently 43/i }),
    ).toBeVisible()
  })
})

test.describe('Archive & Stats', () => {
  test('finishing a game populates the archive and stats', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'New game' }).click()

    // Low target so a single score finishes the game.
    const target = page.getByLabel('Target', { exact: true })
    await target.fill('20')
    await target.press('Tab')
    await page.getByRole('button', { name: 'Start game' }).click()

    await page.getByRole('button', { name: 'Enter score for Player 1' }).click()
    await page.getByRole('textbox', { name: 'Score for this round' }).fill('25')
    await page.getByRole('button', { name: 'Save score' }).click()

    // Game finished → results.
    await expect(page.getByRole('heading', { name: /wins!/i })).toBeVisible()

    // Archive lists the finished game.
    await page.goto('/archive')
    await expect(page.getByRole('heading', { name: 'Archive' })).toBeVisible()
    await expect(
      page.getByRole('button', { name: /Remove favourite|Favourite/ }).first(),
    ).toBeVisible()

    // Stats shows aggregated totals.
    await page.goto('/stats')
    await expect(page.getByRole('heading', { name: 'Stats' })).toBeVisible()
    await expect(page.getByText('Records')).toBeVisible()
  })
})
