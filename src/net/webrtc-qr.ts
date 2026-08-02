import { createId } from '@/lib/id'

import type { LinkState, PeerLink } from './transport'

/**
 * The offline transport: a pure peer-to-peer WebRTC data channel whose signaling
 * is carried by QR codes, so it needs **no server and no internet** — only that
 * both phones sit on the same Wi-Fi / hotspot.
 *
 * The handshake is a manual, one-guest-at-a-time ceremony (there is no channel
 * to automate it over):
 *
 *   1. Host calls {@link createQrOffer} → shows the offer blob as a QR.
 *   2. Guest scans it, calls {@link answerQrOffer} → shows the answer blob back.
 *   3. Host scans the answer and calls `offer.accept(answer)`.
 *   4. The data channel opens and both sides hold an ordinary {@link PeerLink}.
 *
 * ICE is gathered non-trickle (we wait for gathering to settle) so each side's
 * SDP is a single self-contained blob — there is no back-channel to trickle
 * candidates over. No STUN/TURN is configured: on a shared LAN the host
 * candidates connect directly, and off-LAN is out of scope for the offline path.
 */
export function isWebRtcSupported(): boolean {
  return typeof RTCPeerConnection !== 'undefined'
}

const CHANNEL_LABEL = 'flip'
const RTC_CONFIG: RTCConfiguration = { iceServers: [] }
const ICE_TIMEOUT_MS = 3000
const CHANNEL_TIMEOUT_MS = 20000

interface Signal {
  t: 'offer' | 'answer'
  id: string
  sdp: string
}

function encodeSignal(signal: Signal): string {
  return btoa(unescape(encodeURIComponent(JSON.stringify(signal))))
}

export function decodeSignal(blob: string): Signal | null {
  try {
    const json = decodeURIComponent(escape(atob(blob.trim())))
    const value = JSON.parse(json)
    if (
      value &&
      (value.t === 'offer' || value.t === 'answer') &&
      typeof value.id === 'string' &&
      typeof value.sdp === 'string'
    ) {
      return value as Signal
    }
  } catch {
    // Not a valid signal blob.
  }
  return null
}

function waitIceComplete(pc: RTCPeerConnection): Promise<void> {
  if (pc.iceGatheringState === 'complete') return Promise.resolve()
  return new Promise((resolve) => {
    const done = () => {
      pc.removeEventListener('icegatheringstatechange', check)
      clearTimeout(timer)
      resolve()
    }
    const check = () => {
      if (pc.iceGatheringState === 'complete') done()
    }
    // Host-only gathering occasionally never reports 'complete'; cap the wait.
    const timer = setTimeout(done, ICE_TIMEOUT_MS)
    pc.addEventListener('icegatheringstatechange', check)
  })
}

class RtcLink implements PeerLink {
  readonly id: string
  state: LinkState = 'connecting'
  private readonly pc: RTCPeerConnection
  private readonly channel: RTCDataChannel
  private readonly messageCbs: ((data: string) => void)[] = []
  private readonly openCbs: (() => void)[] = []
  private readonly closeCbs: (() => void)[] = []

  constructor(id: string, pc: RTCPeerConnection, channel: RTCDataChannel) {
    this.id = id
    this.pc = pc
    this.channel = channel
    if (channel.readyState === 'open') this.state = 'open'
    channel.onopen = () => {
      this.state = 'open'
      for (const cb of this.openCbs) cb()
    }
    channel.onmessage = (event) => {
      if (typeof event.data === 'string') {
        for (const cb of this.messageCbs) cb(event.data)
      }
    }
    channel.onclose = () => this.close()
    pc.onconnectionstatechange = () => {
      const s = pc.connectionState
      if (s === 'failed' || s === 'disconnected' || s === 'closed') this.close()
    }
  }

  send(data: string): void {
    if (this.state === 'open' && this.channel.readyState === 'open') {
      this.channel.send(data)
    }
  }

  close(): void {
    if (this.state === 'closed') return
    this.state = 'closed'
    for (const cb of this.closeCbs) cb()
    try {
      this.channel.close()
    } catch {
      /* already closing */
    }
    try {
      this.pc.close()
    } catch {
      /* already closing */
    }
  }

  onMessage(cb: (data: string) => void): void {
    this.messageCbs.push(cb)
  }
  onOpen(cb: () => void): void {
    this.openCbs.push(cb)
    if (this.state === 'open') cb()
  }
  onClose(cb: () => void): void {
    this.closeCbs.push(cb)
    if (this.state === 'closed') cb()
  }
}

function waitChannelOpen(link: RtcLink): Promise<PeerLink> {
  return new Promise((resolve, reject) => {
    let settled = false
    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      link.close()
      reject(new Error('The connection timed out.'))
    }, CHANNEL_TIMEOUT_MS)
    link.onOpen(() => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve(link)
    })
    link.onClose(() => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      reject(new Error('The connection closed before it opened.'))
    })
  })
}

export interface QrOffer {
  /** Connection id (shared by both ends of this handshake). */
  id: string
  /** The blob to render as a QR for the guest to scan. */
  blob: string
  /** Complete the handshake with the guest's scanned answer blob. */
  accept(answerBlob: string): Promise<PeerLink>
  /** Tear down the underlying peer connection if the offer is abandoned. */
  close(): void
}

/** Host: mint a fresh offer for one guest. */
export async function createQrOffer(): Promise<QrOffer> {
  const id = createId()
  const pc = new RTCPeerConnection(RTC_CONFIG)
  const channel = pc.createDataChannel(CHANNEL_LABEL, { ordered: true })
  const link = new RtcLink(id, pc, channel)

  await pc.setLocalDescription(await pc.createOffer())
  await waitIceComplete(pc)
  const sdp = pc.localDescription?.sdp ?? ''
  const blob = encodeSignal({ t: 'offer', id, sdp })

  return {
    id,
    blob,
    async accept(answerBlob: string): Promise<PeerLink> {
      const signal = decodeSignal(answerBlob)
      if (!signal || signal.t !== 'answer') {
        throw new Error('That is not a valid answer code.')
      }
      await pc.setRemoteDescription({ type: 'answer', sdp: signal.sdp })
      return waitChannelOpen(link)
    },
    close(): void {
      link.close()
    },
  }
}

export interface QrAnswer {
  /** The blob to render as a QR for the host to scan. */
  blob: string
  /** Resolves with the link once the host accepts and the channel opens. */
  link: Promise<PeerLink>
}

/** Guest: consume the host's scanned offer and produce an answer. */
export async function answerQrOffer(offerBlob: string): Promise<QrAnswer> {
  const signal = decodeSignal(offerBlob)
  if (!signal || signal.t !== 'offer') {
    throw new Error('That is not a valid invite code.')
  }
  const pc = new RTCPeerConnection(RTC_CONFIG)

  const link = new Promise<PeerLink>((resolve, reject) => {
    // If the host never accepts, `ondatachannel` never fires — cap the wait so
    // the guest's peer connection can't leak forever.
    const timer = setTimeout(() => {
      try {
        pc.close()
      } catch {
        /* already closing */
      }
      reject(new Error('The host didn’t connect in time.'))
    }, CHANNEL_TIMEOUT_MS)
    pc.ondatachannel = (event) => {
      clearTimeout(timer)
      const rtcLink = new RtcLink(signal.id, pc, event.channel)
      waitChannelOpen(rtcLink).then(resolve, reject)
    }
  })

  await pc.setRemoteDescription({ type: 'offer', sdp: signal.sdp })
  await pc.setLocalDescription(await pc.createAnswer())
  await waitIceComplete(pc)
  const sdp = pc.localDescription?.sdp ?? ''
  const blob = encodeSignal({ t: 'answer', id: signal.id, sdp })

  return { blob, link }
}
