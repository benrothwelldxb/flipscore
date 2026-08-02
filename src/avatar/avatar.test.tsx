import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { Avatar } from './avatar'
import { generateAvatar } from './generate'

const config = generateAvatar('Ben')

function svgOf(container: HTMLElement): SVGSVGElement {
  const svg = container.querySelector('svg')
  if (!svg) throw new Error('no svg rendered')
  return svg as SVGSVGElement
}

describe('Avatar rendering', () => {
  it('renders an accessible image labelled with the title', () => {
    const { getByRole } = render(<Avatar config={config} title="Ben" />)
    expect(getByRole('img', { name: 'Ben' })).toBeInTheDocument()
  })

  it('renders a lightweight SVG (bounded node count)', () => {
    const { container } = render(<Avatar config={config} />)
    const nodes = svgOf(container).querySelectorAll('*').length
    expect(nodes).toBeGreaterThan(5)
    expect(nodes).toBeLessThan(90)
  })

  it('renders across many seeds without throwing', () => {
    for (let i = 0; i < 40; i += 1) {
      const { container, unmount } = render(
        <Avatar config={generateAvatar(`seed-${i}`)} />,
      )
      expect(container.querySelector('svg')).toBeTruthy()
      unmount()
    }
  })

  it('is deterministic — same config yields identical markup', () => {
    const a = render(<Avatar config={config} />)
    const b = render(<Avatar config={config} />)
    // Ignore the auto-generated clipPath id, which differs per instance.
    const strip = (html: string) =>
      html.replace(/id="[^"]*"/g, 'id="X"').replace(/url\(#[^)]*\)/g, 'url(#X)')
    expect(strip(svgOf(a.container).innerHTML)).toEqual(
      strip(svgOf(b.container).innerHTML),
    )
  })

  it('adds a crown overlay for the leader', () => {
    const plain = svgOf(render(<Avatar config={config} />).container)
    const crowned = svgOf(render(<Avatar config={config} crown />).container)
    expect(crowned.querySelectorAll('*').length).toBeGreaterThan(
      plain.querySelectorAll('*').length,
    )
  })

  it('renders a distinct bust expression', () => {
    const normal = svgOf(render(<Avatar config={config} />).container).innerHTML
    const bust = svgOf(
      render(<Avatar config={config} expression="bust" />).container,
    ).innerHTML
    expect(bust).not.toEqual(normal)
  })
})
