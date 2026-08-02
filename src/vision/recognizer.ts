import { createOcrRecognizer } from './ocr-recognizer'
import type { CardRecognizer } from './types'

/**
 * Registry of available recognizers. This is the upgrade seam: to ship a better
 * model (a trained detector, a hosted vision API, a WASM CNN), add an entry with
 * its own `create()` — the camera scorer and settings pick it up automatically,
 * and no other code changes.
 */
export interface RecognizerInfo {
  id: string
  label: string
  description: string
  experimental: boolean
  create: () => CardRecognizer
}

export const RECOGNIZERS: readonly RecognizerInfo[] = [
  {
    id: 'ocr-v1',
    label: 'On-device OCR',
    description:
      'Reads card numerals and modifiers on-device. Experimental — always check the result.',
    experimental: true,
    create: () => createOcrRecognizer(),
  },
]

export const DEFAULT_RECOGNIZER_ID = 'ocr-v1'

export function getRecognizerInfo(
  id: string = DEFAULT_RECOGNIZER_ID,
): RecognizerInfo {
  return RECOGNIZERS.find((r) => r.id === id) ?? RECOGNIZERS[0]
}
