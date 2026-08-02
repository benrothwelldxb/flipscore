/**
 * Camera Scoring — recognizer contract.
 *
 * This module is deliberately isolated from the rest of the app: nothing here
 * imports UI, and the only thing the app depends on is the {@link CardRecognizer}
 * interface + the pure mappers. Swapping the experimental OCR model for a real
 * trained model later means implementing this one interface and registering it —
 * no caller changes.
 */

/** What kind of Flip 7 card was detected. */
export type DetectedCardKind = 'number' | 'modifier' | 'flip7' | 'bust'

export interface DetectedCard {
  kind: DetectedCardKind
  /**
   * For `number`: the integer 0–12.
   * For `modifier`: the modifier token (`'+2'|'+4'|'+6'|'+8'|'+10'|'x2'`).
   * Absent for `flip7` / `bust`.
   */
  value?: number | string
  /** Recognizer confidence, 0–1. */
  confidence: number
}

export interface RecognitionResult {
  cards: DetectedCard[]
  /** Optional human-facing note (e.g. why nothing was found). */
  note?: string
}

/** Anything a recognizer can read a frame from. */
export type RecognizerInput =
  HTMLCanvasElement | HTMLVideoElement | ImageBitmap | Blob

/**
 * A pluggable card recognizer. Future AI models implement exactly this.
 * Implementations may be heavy (a WASM OCR engine, a TF.js/ONNX model); they are
 * created lazily and disposed when the scorer unmounts.
 */
export interface CardRecognizer {
  readonly id: string
  readonly label: string
  recognize(input: RecognizerInput): Promise<RecognitionResult>
  /** Release heavy resources (workers, models). Optional. */
  dispose?(): Promise<void>
}
