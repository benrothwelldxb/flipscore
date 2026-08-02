import { usePrefsStore } from '@/stores/prefs-store'

export type SoundName = 'tap' | 'save' | 'undo' | 'win'

let ctx: AudioContext | null = null

function audio(): AudioContext | null {
  if (typeof window === 'undefined') return null
  const AudioCtor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext
  if (!AudioCtor) return null
  ctx ??= new AudioCtor()
  return ctx
}

function tone(
  ac: AudioContext,
  freq: number,
  start: number,
  duration: number,
  gain = 0.05,
  type: OscillatorType = 'sine',
) {
  const osc = ac.createOscillator()
  const envelope = ac.createGain()
  osc.type = type
  osc.frequency.value = freq
  envelope.gain.setValueAtTime(0, start)
  envelope.gain.linearRampToValueAtTime(gain, start + 0.012)
  envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration)
  osc.connect(envelope).connect(ac.destination)
  osc.start(start)
  osc.stop(start + duration)
}

const RECIPES: Record<SoundName, (ac: AudioContext, t: number) => void> = {
  tap: (ac, t) => tone(ac, 520, t, 0.07, 0.035, 'triangle'),
  save: (ac, t) => {
    tone(ac, 440, t, 0.1)
    tone(ac, 660, t + 0.06, 0.12)
  },
  undo: (ac, t) => {
    tone(ac, 400, t, 0.1)
    tone(ac, 300, t + 0.05, 0.12)
  },
  win: (ac, t) => {
    ;[523, 659, 784, 1046].forEach((freq, i) =>
      tone(ac, freq, t + i * 0.1, 0.25, 0.06, 'triangle'),
    )
  },
}

/** Play a subtle synthesized sound if the user has enabled sound. */
export function playSound(name: SoundName): void {
  if (!usePrefsStore.getState().soundEnabled) return
  const ac = audio()
  if (!ac) return
  if (ac.state !== 'running') {
    // Unlock for next time; skip this one so stale tones can't queue up.
    void ac.resume().catch(() => {})
    return
  }
  try {
    RECIPES[name](ac, ac.currentTime)
  } catch {
    /* Audio can fail on locked contexts — ignore. */
  }
}
