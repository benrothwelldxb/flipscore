import { describe, expect, it, vi } from 'vitest'

import { createOcrRecognizer, type OcrEngine } from './ocr-recognizer'
import type { OcrToken } from './parse'

function fakeEngine(tokens: OcrToken[]): OcrEngine {
  return {
    recognize: vi.fn(async () => tokens),
    terminate: vi.fn(async () => {}),
  }
}

describe('OCR recognizer (with an injected fake engine)', () => {
  it('parses the engine output into detected cards', async () => {
    const recognizer = createOcrRecognizer(async () =>
      fakeEngine([
        { text: '3', confidence: 0.9 },
        { text: '5', confidence: 0.9 },
        { text: '+4', confidence: 0.8 },
      ]),
    )
    const canvas = document.createElement('canvas')
    const result = await recognizer.recognize(canvas)
    expect(result.cards.map((c) => c.value)).toEqual([3, 5, '+4'])
  })

  it('notes when nothing is recognised', async () => {
    const recognizer = createOcrRecognizer(async () =>
      fakeEngine([{ text: '???', confidence: 0.1 }]),
    )
    const result = await recognizer.recognize(document.createElement('canvas'))
    expect(result.cards).toEqual([])
    expect(result.note).toMatch(/no cards/i)
  })

  it('loads the engine once and terminates it on dispose', async () => {
    const engine = fakeEngine([{ text: '7', confidence: 1 }])
    const loader = vi.fn(async () => engine)
    const recognizer = createOcrRecognizer(loader)
    const canvas = document.createElement('canvas')
    await recognizer.recognize(canvas)
    await recognizer.recognize(canvas)
    expect(loader).toHaveBeenCalledTimes(1)
    await recognizer.dispose?.()
    expect(engine.terminate).toHaveBeenCalledTimes(1)
  })
})
