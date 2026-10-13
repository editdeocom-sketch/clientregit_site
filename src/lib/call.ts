import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js'

export type CallKind = 'user' | 'guest'

export interface PresenceMeta {
  peerId: string
  name: string
  kind: CallKind
  isHost: boolean
  admitted: boolean
  micOn: boolean
  camOn: boolean
  screenOn: boolean
}

export interface CallPeerState {
  peerId: string
  name: string
  kind: CallKind
  isHost: boolean
  admitted: boolean
  micOn: boolean
  camOn: boolean
  screenOn: boolean
  connectionState: RTCPeerConnectionState
  stream: MediaStream | null
  screenStream: MediaStream | null
}

export interface CallSelfState {
  waitingInLobby: boolean
  denied: boolean
  admitted: boolean
  micOn: boolean
  camOn: boolean
  screenOn: boolean
}

export interface LobbyRequest {
  peerId: string
  name: string
}

export interface CallCallbacks {
  onPeers: (peers: CallPeerState[]) => void
  onSelf: (state: CallSelfState) => void
  onLobbyRequest: (request: LobbyRequest) => void
  onReaction: (reaction: { name: string; emoji: string }) => void
  onError: (message: string) => void
}

export interface CallEngineOptions {
  client: SupabaseClient
  code: string
  meetingId: string
  sessionId: string | null
  name: string
  kind: CallKind
  userId: string | null
  isHost: boolean
  lobbyEnabled: boolean
  localStream: MediaStream
  callbacks: CallCallbacks
}

type SignalMessage =
  | { t: 'sdp'; to: string; from: string; desc: RTCSessionDescriptionInit }
  | { t: 'ice'; to: string; from: string; candidate: RTCIceCandidateInit | null }
  | { t: 'lobby'; to: string; from: string; ok: boolean }
  | { t: 'reaction'; from: string; name: string; emoji: string }
  | { t: 'bye'; from: string }

const ICE_SERVERS: RTCIceServer[] = [
  {
    urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302', 'stun:stun.cloudflare.com:3478']
  }
]

interface PeerRecord {
  meta: PresenceMeta
  pc: RTCPeerConnection
  makingOffer: boolean
  pendingIce: RTCIceCandidateInit[]
  pendingSdp: RTCSessionDescriptionInit | null
  remote: MediaStream | null
  remoteScreen: MediaStream | null
}

export class CallEngine {
  private readonly options: CallEngineOptions
  private readonly callbacks: CallCallbacks
  private readonly peerId: string
  private channel: RealtimeChannel | null = null
  private readonly peers = new Map<string, PeerRecord>()
  private readonly selfMeta: PresenceMeta
  private participantRowId: string | null = null
  private screenStream: MediaStream | null = null
  private left = false

  private selfState: CallSelfState

  constructor(options: CallEngineOptions) {
    this.options = options
    this.callbacks = options.callbacks
    this.peerId = crypto.randomUUID()
    const admitted = !(
      options.lobbyEnabled && options.kind === 'guest' && !options.isHost
    )
    this.selfMeta = {
      peerId: this.peerId,
      name: options.name,
      kind: options.kind,
      isHost: options.isHost,
      admitted,
      micOn: true,
      camOn: true,
      screenOn: false
    }
    this.selfState = {
      waitingInLobby: !admitted,
      denied: false,
      admitted,
      micOn: true,
      camOn: true,
      screenOn: false
    }
  }

  getSelfPeerId(): string {
    return this.peerId
  }

  async start(): Promise<void> {
    const { client, code } = this.options
    const channel = client.channel(`meet:${code}`, {
      config: { broadcast: { self: false } }
    })
    this.channel = channel

    channel.on('broadcast', { event: 'sig' }, ({ payload }) => {
      void this.handleSignal(payload as SignalMessage)
    })
    channel.on('presence', { event: 'sync' }, () => this.syncPeers())
    channel.on('presence', { event: 'join' }, () => this.syncPeers())
    channel.on('presence', { event: 'leave' }, () => this.syncPeers())

    await new Promise<void>((resolve) => {
      channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') resolve()
        if (status === 'CHANNEL_ERROR') {
          this.callbacks.onError('Realtime connection failed. Check your network.')
          resolve()
        }
      })
    })

    await channel.track(this.selfMeta as unknown as Record<string, unknown>)

    if (this.options.sessionId) {
      await this.recordParticipant()
    }

    this.emitSelf()
    this.syncPeers()
  }

  private async recordParticipant(): Promise<void> {
    const { client, meetingId, sessionId, kind, name, userId } = this.options
    if (!sessionId) return
    try {
      const rowId = crypto.randomUUID()
      const { error } = await client.from('call_participants').insert({
        id: rowId,
        session_id: sessionId,
        meeting_id: meetingId,
        participant_kind: kind,
        participant_id: userId ?? this.peerId,
        name
      })
      if (!error) this.participantRowId = rowId
    } catch {
      // history is best-effort
    }
  }

  setMic(on: boolean): void {
    const track = this.options.localStream.getAudioTracks()[0]
    if (track) track.enabled = on
    this.selfMeta.micOn = on
    this.selfState.micOn = on
    void this.channel?.track(this.selfMeta as unknown as Record<string, unknown>)
    this.emitSelf()
    this.emitPeers()
  }

  setCam(on: boolean): void {
    const track = this.options.localStream.getVideoTracks()[0]
    if (track) track.enabled = on
    this.selfMeta.camOn = on
    this.selfState.camOn = on
    void this.channel?.track(this.selfMeta as unknown as Record<string, unknown>)
    this.emitSelf()
    this.emitPeers()
  }

  async startScreen(stream: MediaStream): Promise<void> {
    this.screenStream = stream
    for (const record of this.peers.values()) {
      for (const track of stream.getTracks()) {
        record.pc.addTrack(track, stream)
      }
    }
    this.selfMeta.screenOn = true
    this.selfState.screenOn = true
    void this.channel?.track(this.selfMeta as unknown as Record<string, unknown>)
    this.emitSelf()
    this.emitPeers()
  }

  stopScreen(): void {
    const screen = this.screenStream
    if (!screen) return
    const screenTracks = new Set(screen.getTracks())
    for (const record of this.peers.values()) {
      for (const sender of record.pc.getSenders()) {
        if (sender.track && screenTracks.has(sender.track)) {
          try {
            record.pc.removeTrack(sender)
          } catch {
            // peer may be closing
          }
        }
      }
    }
    this.screenStream = null
    this.selfMeta.screenOn = false
    this.selfState.screenOn = false
    void this.channel?.track(this.selfMeta as unknown as Record<string, unknown>)
    this.emitSelf()
    this.emitPeers()
  }

  admit(peerId: string): void {
    this.send({ t: 'lobby', to: peerId, from: this.peerId, ok: true })
  }

  deny(peerId: string): void {
    this.send({ t: 'lobby', to: peerId, from: this.peerId, ok: false })
  }

  sendReaction(emoji: string): void {
    this.send({ t: 'reaction', from: this.peerId, name: this.options.name, emoji })
  }

  private send(message: SignalMessage): void {
    void this.channel?.send({ type: 'broadcast', event: 'sig', payload: message })
  }

  private async handleSignal(raw: SignalMessage): Promise<void> {
    if (!raw || typeof raw !== 'object' || !raw.t) return
    if ('from' in raw && raw.from === this.peerId) return

    switch (raw.t) {
      case 'sdp': {
        if (raw.to !== this.peerId) return
        const record = this.peers.get(raw.from)
        if (!record) {
          this.pendingSignals.set(raw.from, (this.pendingSignals.get(raw.from) ?? []).concat(raw))
          return
        }
        await this.enqueue(raw.from, () => this.handleSdp(record, raw.from, raw.desc))
        return
      }
      case 'ice': {
        if (raw.to !== this.peerId) return
        const record = this.peers.get(raw.from)
        if (!record) {
          this.pendingSignals.set(raw.from, (this.pendingSignals.get(raw.from) ?? []).concat(raw))
          return
        }
        await this.enqueue(raw.from, () => this.addIce(record, raw.candidate))
        return
      }
      case 'lobby': {
        if (raw.to !== this.peerId) return
        if (raw.ok) {
          this.selfMeta.admitted = true
          this.selfState.admitted = true
          this.selfState.waitingInLobby = false
          this.selfState.denied = false
          void this.channel?.track(this.selfMeta as unknown as Record<string, unknown>)
          this.emitSelf()
          this.syncPeers()
        } else {
          this.selfState.waitingInLobby = false
          this.selfState.denied = true
          this.emitSelf()
        }
        return
      }
      case 'reaction': {
        this.callbacks.onReaction({ name: raw.name, emoji: raw.emoji })
        return
      }
      case 'bye': {
        this.closePeer(raw.from)
        return
      }
    }
  }

  private readonly pendingSignals = new Map<string, SignalMessage[]>()
  private readonly lobbyNotified = new Set<string>()
  private readonly signalQueues = new Map<string, Promise<void>>()

  private enqueue(peerId: string, task: () => Promise<void>): Promise<void> {
    const prev = this.signalQueues.get(peerId) ?? Promise.resolve()
    const next = prev.then(() => task())
    this.signalQueues.set(peerId, next.catch(() => undefined))
    return next
  }

  private syncPeers(): void {
    if (this.left) return
    const channel = this.channel
    if (!channel) return
    const state = channel.presenceState<PresenceMeta>()
    const metas = new Map<string, PresenceMeta>()
    for (const rows of Object.values(state)) {
      for (const meta of rows) {
        if (meta && typeof meta.peerId === 'string') metas.set(meta.peerId, meta)
      }
    }
    metas.delete(this.peerId)

    if (this.selfMeta.isHost) {
      for (const [peerId, meta] of metas) {
        if (!meta.admitted && meta.kind === 'guest' && !this.lobbyNotified.has(peerId)) {
          this.lobbyNotified.add(peerId)
          this.callbacks.onLobbyRequest({ peerId, name: meta.name })
        }
      }
    }

    for (const peerId of [...this.peers.keys()]) {
      if (!metas.has(peerId)) this.closePeer(peerId)
    }

    for (const [peerId, meta] of metas) {
      const record = this.peers.get(peerId)
      if (record) {
        record.meta = { ...meta, name: meta.name || peerId.slice(0, 6) }
      }
    }

    if (this.selfMeta.admitted) {
      for (const [peerId, meta] of metas) {
        if (meta.admitted && !this.peers.has(peerId)) {
          this.createPeer(peerId, meta)
        }
      }
    }

    this.emitPeers()
  }

  private createPeer(peerId: string, meta: PresenceMeta): void {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })
    const record: PeerRecord = {
      meta,
      pc,
      makingOffer: false,
      pendingIce: [],
      pendingSdp: null,
      remote: null,
      remoteScreen: null
    }
    this.peers.set(peerId, record)

    const local = this.options.localStream
    for (const track of local.getTracks()) {
      pc.addTrack(track, local)
    }
    if (this.screenStream) {
      for (const track of this.screenStream.getTracks()) {
        pc.addTrack(track, this.screenStream)
      }
    }

    pc.onicecandidate = (event) => {
      this.send({ t: 'ice', to: peerId, from: this.peerId, candidate: event.candidate?.toJSON() ?? null })
    }

    pc.onnegotiationneeded = () => {
      void this.enqueue(peerId, async () => {
        if (pc.signalingState !== 'stable') return
        try {
          record.makingOffer = true
          await pc.setLocalDescription()
          const desc = pc.localDescription
          if (desc) this.send({ t: 'sdp', to: peerId, from: this.peerId, desc })
        } catch (err: unknown) {
          this.callbacks.onError(err instanceof Error ? err.message : 'Negotiation failed.')
        } finally {
          record.makingOffer = false
        }
      })
    }

    pc.ontrack = (event) => {
      const stream = event.streams[0] ?? new MediaStream([event.track])
      const videoOnly =
        event.track.kind === 'video' && stream.getAudioTracks().length === 0
      if (videoOnly) {
        record.remoteScreen = stream
      } else {
        record.remote = stream
      }
      this.emitPeers()
    }

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed') {
        try {
          pc.restartIce()
        } catch {
          // connection is closing
        }
      }
      this.emitPeers()
    }

    this.peers.set(peerId, record)
    void this.enqueue(peerId, () => this.flushPending(peerId, record))
  }

  private async flushPending(peerId: string, record: PeerRecord): Promise<void> {
    const queued = this.pendingSignals.get(peerId) ?? []
    this.pendingSignals.delete(peerId)
    for (const message of queued) {
      if (message.t === 'sdp') await this.handleSdp(record, peerId, message.desc)
      else if (message.t === 'ice') await this.addIce(record, message.candidate)
    }
  }

  private async handleSdp(
    record: PeerRecord,
    peerId: string,
    desc: RTCSessionDescriptionInit
  ): Promise<void> {
    const pc = record.pc
    const polite = this.peerId < peerId
    const offerCollision =
      desc.type === 'offer' && (pc.signalingState !== 'stable' || record.makingOffer)
    if (!polite && offerCollision) return
    if (polite && offerCollision) {
      try {
        await pc.setLocalDescription({ type: 'rollback' })
      } catch {
        // unified-plan rollbacks are implicit in modern browsers
      }
    }
    try {
      await pc.setRemoteDescription(desc)
    } catch (err: unknown) {
      this.callbacks.onError(err instanceof Error ? err.message : 'Connection error.')
      return
    }
    for (const candidate of record.pendingIce.splice(0)) {
      try {
        await pc.addIceCandidate(candidate)
      } catch {
        // candidate raced the description
      }
    }
    if (desc.type === 'offer') {
      try {
        await pc.setLocalDescription()
        const answer = pc.localDescription
        if (answer) this.send({ t: 'sdp', to: peerId, from: this.peerId, desc: answer })
      } catch (err: unknown) {
        this.callbacks.onError(err instanceof Error ? err.message : 'Connection error.')
      }
    }
  }

  private async addIce(record: PeerRecord, candidate: RTCIceCandidateInit | null): Promise<void> {
    if (!candidate) return
    if (!record.pc.remoteDescription) {
      record.pendingIce.push(candidate)
      return
    }
    try {
      await record.pc.addIceCandidate(candidate)
    } catch {
      // candidate raced the description
    }
  }

  private closePeer(peerId: string): void {
    const record = this.peers.get(peerId)
    if (!record) return
    this.peers.delete(peerId)
    this.pendingSignals.delete(peerId)
    this.signalQueues.delete(peerId)
    try {
      record.pc.close()
    } catch {
      // already closed
    }
    this.emitPeers()
  }

  private emitSelf(): void {
    this.callbacks.onSelf({ ...this.selfState })
  }

  private emitPeers(): void {
    const peers: CallPeerState[] = []
    for (const [peerId, record] of this.peers) {
      peers.push({
        peerId,
        name: record.meta.name || peerId.slice(0, 6),
        kind: record.meta.kind,
        isHost: record.meta.isHost,
        admitted: record.meta.admitted,
        micOn: record.meta.micOn,
        camOn: record.meta.camOn,
        screenOn: record.meta.screenOn,
        connectionState: record.pc.connectionState,
        stream: record.remote,
        screenStream: record.remoteScreen
      })
    }
    this.callbacks.onPeers(peers)
  }

  async leave(): Promise<void> {
    if (this.left) return
    this.left = true
    this.send({ t: 'bye', from: this.peerId })
    for (const peerId of [...this.peers.keys()]) this.closePeer(peerId)
    try {
      await this.channel?.untrack()
      await this.channel?.unsubscribe()
      await this.options.client.removeChannel(this.channel!)
    } catch {
      // teardown is best-effort
    }
    this.channel = null

    if (this.participantRowId) {
      try {
        await this.options.client
          .from('call_participants')
          .update({ left_at: new Date().toISOString() })
          .eq('id', this.participantRowId)
      } catch {
        // history is best-effort
      }
    }
  }
}
