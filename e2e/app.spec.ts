import { expect, test } from '@playwright/test'

test.describe('FlipScore app shell', () => {
  test('renders the home screen', async ({ page }) => {
    await page.goto('/')
    await expect(
      page.getByRole('link', { name: 'FlipScore home' }),
    ).toBeVisible()
    await expect(
      page.getByRole('heading', { name: /keep score/i }),
    ).toBeVisible()
  })

  test('opens the start-a-game dialog', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: /start a game/i }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await expect(
      page.getByRole('heading', { name: /almost there/i }),
    ).toBeVisible()
  })

  test('toggles the colour theme', async ({ page }) => {
    await page.goto('/')
    const html = page.locator('html')
    await expect(html).not.toHaveClass(/dark/)
    // Default is "system" (light in the test env) → click to Light, then Dark.
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
    await expect(
      page.getByRole('heading', { name: /keep score/i }),
    ).toBeVisible()
  })
})
