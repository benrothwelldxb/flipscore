/**
 * Thin wrapper around the native Barcode Detection API (not in the TS DOM lib),
 * shared by the QR scanner and the join screen so support can be feature-detected
 * from either without duplicating the shim.
 */
export interface BarcodeDetectorLike {
  detect(source: CanvasImageSource): Promise<{ rawValue: string }[]>
}

interface BarcodeDetectorCtor {
  new (options?: { formats: string[] }): BarcodeDetectorLike
}

export function getBarcodeDetectorCtor(): BarcodeDetectorCtor | null {
  const ctor = (globalThis as { BarcodeDetector?: BarcodeDetectorCtor })
    .BarcodeDetector
  return ctor ?? null
}

export function isScannerSupported(): boolean {
  return (
    getBarcodeDetectorCtor() !== null &&
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia
  )
}
