/**
 * A {@link PeerLink} is a duplex, string-message channel to exactly one peer.
 * Everything above this line (the session logic, the controllers) is written
 * against this interface and never against a concrete transport, so the same
 * code drives a WebRTC data channel, a relayed WebSocket, or an in-process mock
 * link in tests.
 */
export type LinkState = 'connecting' | 'open' | 'closed'

export interface PeerLink {
  /** Stable identifier for this peer (assigned by the signaling layer). */
  readonly id: string
  readonly state: LinkState
  send(data: string): void
  close(): void
  onMessage(cb: (data: string) => void): void
  onOpen(cb: () => void): void
  onClose(cb: () => void): void
}

/**
 * A signaling transport establishes {@link PeerLink}s. The host side emits a
 * link per guest that connects; the guest side yields a single link to the
 * host. Concrete transports: the relay (WebSocket) and the QR handshake.
 */
export interface HostTransport {
  /** Fired once per guest that establishes a link. */
  onPeer(cb: (link: PeerLink) => void): void
  onError(cb: (error: Error) => void): void
  /** Resolves once the transport is ready to accept guests. */
  whenReady(): Promise<void>
  /** Human-facing room code guests use to find this host. */
  readonly roomCode: string
  close(): void
}

export interface GuestTransport {
  /** Resolves with the link to the host, or rejects if signaling fails. */
  connect(): Promise<PeerLink>
  close(): void
}
