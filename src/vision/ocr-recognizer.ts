import { parseTokens, type OcrToken } from './parse'
import type {
  CardRecognizer,
  RecognitionResult,
  RecognizerInput,
} from './types'

/**
 * The initial (experimental) recognizer: on-device OCR via tesseract.js.
 *
 * The WASM engine is heavy, so it is **lazy-loaded** on first use via a dynamic
 * import — it never touches the main bundle and only downloads when the user
 * actually scans. Number cards read as digits and modifiers as `+N` / `x2`;
 * Flip 7 (seven unique numbers) is derived by the scoring engine and Bust is a
 * one-tap correction, so the OCR whitelist is digits + modifier symbols only.
 *
 * The engine is injected, so the recognizer's logic is unit-tested with a fake
 * OCR while the real WASM path stays out of tests.
 */
export interface OcrEngine {
  recognize(canvas: HTMLCanvasElement): Promise<OcrToken[]>
  terminate(): Promise<void>
}

export type OcrEngineLoader = () => Promise<OcrEngine>

const loadTesseract: OcrEngineLoader = async () => {
  const { createWorker } = await import('tesseract.js')
  const worker = await createWorker('eng')
  await worker.setParameters({ tessedit_char_whitelist: '0123456789+xX' })
  return {
    async recognize(canvas) {
      const { data } = await worker.recognize(canvas)
      const confidence = Math.max(0, Math.min(1, (data.confidence ?? 0) / 100))
      return data.text
        .split(/\s+/)
        .map((t) => t.trim())
        .filter(Boolean)
        .map((text) => ({ text, confidence }))
    },
    async terminate() {
      await worker.terminate()
    },
  }
}

async function toCanvas(input: RecognizerInput): Promise<HTMLCanvasElement> {
  if (input instanceof HTMLCanvasElement) return input

  let source: CanvasImageSource
  let width: number
  let height: number
  if (input instanceof HTMLVideoElement) {
    source = input
    width = input.videoWidth
    height = input.videoHeight
  } else if (
    typeof ImageBitmap !== 'undefined' &&
    input instanceof ImageBitmap
  ) {
    source = input
    width = input.width
    height = input.height
  } else {
    const bitmap = await createImageBitmap(input as Blob)
    source = bitmap
    width = bitmap.width
    height = bitmap.height
  }

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  canvas.getContext('2d')?.drawImage(source, 0, 0, width, height)
  return canvas
}

export function createOcrRecognizer(
  loader: OcrEngineLoader = loadTesseract,
): CardRecognizer {
  let enginePromise: Promise<OcrEngine> | null = null
  const engine = () => (enginePromise ??= loader())

  return {
    id: 'ocr-v1',
    label: 'On-device OCR',
    async recognize(input: RecognizerInput): Promise<RecognitionResult> {
      const canvas = await toCanvas(input)
      const tokens = await (await engine()).recognize(canvas)
      const cards = parseTokens(tokens)
      return {
        cards,
        note: cards.length
          ? undefined
          : 'No cards recognised — add them below.',
      }
    },
    async dispose() {
      if (!enginePromise) return
      const resolved = await enginePromise
      await resolved.terminate()
    },
  }
}
