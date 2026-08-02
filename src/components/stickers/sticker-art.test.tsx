import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { STICKERS } from '@/domain/stickers/catalog'

import { StickerArt } from './sticker-art'

const sample = STICKERS[0]

describe('StickerArt', () => {
  it('renders an accessible image when given a title', () => {
    const { getByRole } = render(
      <StickerArt sticker={sample} title={sample.name} />,
    )
    expect(getByRole('img')).toHaveAttribute('aria-label', sample.name)
  })

  it('is decorative (aria-hidden) without a title', () => {
    const { container } = render(<StickerArt sticker={sample} />)
    const svg = container.querySelector('svg')
    expect(svg).toHaveAttribute('aria-hidden', 'true')
  })

  it('renders every sticker both locked and unlocked without error', () => {
    for (const sticker of STICKERS) {
      const unlocked = render(<StickerArt sticker={sticker} />)
      expect(unlocked.container.querySelector('svg')).toBeTruthy()
      unlocked.unmount()

      const locked = render(<StickerArt sticker={sticker} locked />)
      expect(locked.container.querySelector('svg')).toBeTruthy()
      locked.unmount()
    }
  })
})
