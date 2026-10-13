import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  CamIcon,
  ChatIcon,
  ClockIcon,
  CopyIcon,
  LeaveIcon,
  MicIcon,
  PeopleIcon,
  RecordIcon,
  ScreenIcon,
  SendIcon,
  SmileIcon,
  XIcon
} from '@/components/JoinIcons'
import { CallEngine, type CallPeerState, type CallSelfState } from '@/lib/call'
import { supabase } from '@/lib/supabase'
import { DOWNLOADS } from '@shared/site'

interface MeetingInfo {
  ok: boolean
  id?: string
  code?: string
  title?: string
  description?: string | null
  status?: 'scheduled' | 'live' | 'ended' | 'cancelled'
  lobby_enabled?: boolean
  scheduled_at?: string | null
  duration_min?: number | null
  host_name?: string
}

interface MeetingMessage {
  id: string
  sender_kind: 'user' | 'guest'
  sender_id: string
  sender_name: string
  body: string
  created_at: string
}

type Mode = 'idle' | 'waiting' | 'joined'

const REACTIONS = ['\u{1F44D}', '\u{2764}\u{FE0F}', '\u{1F525}', '\u{1F44F}', '\u{1F602}', '\u{1F44B}']

function shortWhen(iso: string | null | undefined): string {
  if (!iso) return ''
  const date = new Date(iso)
  return date.toLocaleString('en-GB', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function Surface({
  stream,
  mirrored,
  showMedia,
  mutedSelf
}: {
  stream: MediaStream | null
  mirrored?: boolean
  showMedia?: boolean
  mutedSelf?: boolean
}): ReactNode {
  const ref = useRef<HTMLVideoElement | null>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (el.srcObject !== stream) el.srcObject = stream
    if (stream) void el.play().catch(() => undefined)
  }, [stream])
  return (
    <video
      ref={ref}
      autoPlay
      playsInline
      muted={!!mutedSelf}
      className={`h-full w-full object-cover ${mirrored ? '-scale-x-100' : ''}`}
      style={{ display: showMedia === false ? 'none' : undefined }}
    />
  )
}

export function Join(): ReactNode {
  const { code = '' } = useParams()
  const [info, setInfo] = useState<MeetingInfo | null | undefined>(undefined)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [mode, setMode] = useState<Mode>('idle')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [joinError, setJoinError] = useState<string | null>(null)

  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [previewTick, setPreviewTick] = useState(0)
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  const [camId, setCamId] = useState('')
  const [micId, setMicId] = useState('')
  const [deviceError, setDeviceError] = useState<string | null>(null)
  const [micOn, setMicOn] = useState(true)
  const [camOn, setCamOn] = useState(true)

  const [peers, setPeers] = useState<CallPeerState[]>([])
  const [selfState, setSelfState] = useState<CallSelfState | null>(null)
  const [screenActive, setScreenActive] = useState(false)
  const [panel, setPanel] = useState<'chat' | 'people' | null>(null)
  const [chat, setChat] = useState<MeetingMessage[] | null>(null)
  const [chatDraft, setChatDraft] = useState('')
  const [seenChat, setSeenChat] = useState(0)
  const [floats, setFloats] = useState<Array<{ id: number; emoji: string }>>([])
  const [reactionBar, setReactionBar] = useState(false)
  const [recording, setRecording] = useState(false)
  const [recordSeconds, setRecordSeconds] = useState(0)
  const [left, setLeft] = useState(false)
  const [status, setStatus] = useState('')

  const engineRef = useRef<CallEngine | null>(null)
  const localStreamRef = useRef<MediaStream | null>(null)
  const localScreenRef = useRef<MediaStream | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const recordStartRef = useRef<number>(0)
  const chatSubRef = useRef<{ unsubscribe: () => void } | null>(null)

  const loadRoom = useCallback(async (): Promise<void> => {
    try {
      const { data, error } = await supabase().rpc('get_meeting_by_code', { p_code: code })
      if (error) throw new Error(error.message)
      const payload = data as MeetingInfo | null
      if (!payload?.ok || !payload.id) {
        setInfo(null)
        return
      }
      setInfo(payload)
      setLoadError(null)
    } catch (err: unknown) {
      setLoadError(err instanceof Error ? err.message : 'Could not load the meeting.')
    }
  }, [code])

  useEffect(() => {
    void loadRoom()
  }, [loadRoom])

  const meetingStatus = info?.status
  const meetingOpen = meetingStatus === 'scheduled' || meetingStatus === 'live'

  useEffect(() => {
    if (!info || !meetingOpen) return
    const timer = setInterval(() => void loadRoom(), 4000)
    return () => clearInterval(timer)
  }, [info, meetingOpen, loadRoom])

  useEffect(() => {
    const stored = sessionStorage.getItem('join-name')
    if (stored) setName(stored)
  }, [])

  const setupDevices = useCallback(async (): Promise<void> => {
    if (localStreamRef.current) return
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      localStreamRef.current = stream
      setLocalStream(stream)
      setPreviewTick((tick) => tick + 1)
      const list = await navigator.mediaDevices.enumerateDevices()
      setDevices(list)
      const video = stream.getVideoTracks()[0]
      const audio = stream.getAudioTracks()[0]
      const videoId = video ? video.getSettings().deviceId : undefined
      const audioId = audio ? audio.getSettings().deviceId : undefined
      if (videoId) setCamId(videoId)
      if (audioId) setMicId(audioId)
    } catch {
      setDeviceError('Camera and microphone access is needed to join with audio and video.')
    }
  }, [])

  useEffect(() => {
    void setupDevices()
    return () => {
      const engine = engineRef.current
      if (engine) void engine.leave()
      localStreamRef.current?.getTracks().forEach((track) => track.stop())
      localScreenRef.current?.getTracks().forEach((track) => track.stop())
      if (recorderRef.current && recorderRef.current.state !== 'inactive') {
        recorderRef.current.stop()
      }
      audioCtxRef.current?.close().catch(() => undefined)
      chatSubRef.current?.unsubscribe()
    }
  }, [setupDevices])

  const switchDevice = async (nextCam: string, nextMic: string): Promise<void> => {
    if (engineRef.current) return
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: nextCam ? { deviceId: { exact: nextCam } } : true,
        audio: nextMic ? { deviceId: { exact: nextMic } } : true
      })
      localStreamRef.current?.getTracks().forEach((track) => track.stop())
      localStreamRef.current = stream
      setLocalStream(stream)
      setPreviewTick((tick) => tick + 1)
    } catch {
      setStatus('Could not switch device.')
      setTimeout(() => setStatus(''), 3000)
    }
  }

  const pushFloat = (emoji: string): void => {
    const id = Date.now() + Math.random()
    setFloats((prev) => [...prev, { id, emoji }])
    setTimeout(() => setFloats((prev) => prev.filter((item) => item.id !== id)), 2400)
  }

  const watchChat = (meetingId: string): void => {
    chatSubRef.current?.unsubscribe()
    const channel = supabase()
      .channel(`join-chat-${meetingId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'meeting_messages',
          filter: `meeting_id=eq.${meetingId}`
        },
        (payload) => {
          const message = payload.new as MeetingMessage
          setChat((prev) => {
            if (prev?.some((row) => row.id === message.id)) return prev
            return [...(prev ?? []), message]
          })
        }
      )
      .subscribe()
    chatSubRef.current = { unsubscribe: () => void supabase().removeChannel(channel) }
  }

  const enterCall = async (): Promise<void> => {
    if (!info?.id || engineRef.current) return
    setBusy(true)
    setJoinError(null)
    try {
      const local = localStreamRef.current
      if (!local) throw new Error('Camera and microphone are not ready.')
      let sessionId: string | null = null
      try {
        const { data, error } = await supabase().rpc('active_call_session', {
          p_meeting_id: info.id
        })
        if (!error) sessionId = data as string | null
      } catch {
        sessionId = null
      }

      const engine = new CallEngine({
        client: supabase(),
        code,
        meetingId: info.id,
        sessionId,
        name: name.trim() || 'Guest',
        kind: 'guest',
        userId: null,
        isHost: false,
        lobbyEnabled: !!info.lobby_enabled,
        localStream: local,
        callbacks: {
          onPeers: setPeers,
          onSelf: setSelfState,
          onLobbyRequest: () => undefined,
          onReaction: (reaction) => pushFloat(reaction.emoji),
          onError: (message) => {
            setJoinError(message)
          }
        }
      })
      engineRef.current = engine
      await engine.start()
      setMode('joined')

      const { data: rows, error: chatError } = await supabase()
        .from('meeting_messages')
        .select('*')
        .eq('meeting_id', info.id)
        .order('created_at', { ascending: true })
        .limit(500)
      setChat(chatError ? [] : ((rows ?? []) as MeetingMessage[]))
      watchChat(info.id)
    } catch (err: unknown) {
      engineRef.current = null
      const message = err instanceof Error ? err.message : 'Could not join the call.'
      setJoinError(message)
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    if (mode === 'waiting' && info?.status === 'live') void enterCall()
  }, [mode, info?.status]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleJoin = async (): Promise<void> => {
    if (!info) return
    if (!name.trim()) {
      setJoinError('Enter your name to join.')
      return
    }
    sessionStorage.setItem('join-name', name.trim())
    setBusy(true)
    try {
      if (info.status === 'scheduled') {
        setMode('waiting')
        setBusy(false)
        return
      }
      setBusy(false)
      await enterCall()
    } catch {
      setBusy(false)
      setJoinError('Could not join the meeting.')
    }
  }

  const leaveCall = async (): Promise<void> => {
    setLeft(true)
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop()
    }
    setRecording(false)
    const engine = engineRef.current
    engineRef.current = null
    localScreenRef.current?.getTracks().forEach((track) => track.stop())
    localScreenRef.current = null
    await engine?.leave()
    localStreamRef.current?.getTracks().forEach((track) => track.stop())
    localStreamRef.current = null
  }

  useEffect(() => {
    if (!info) return
    if (info.status !== 'ended' && info.status !== 'cancelled') return
    const engine = engineRef.current
    if (engine) {
      engineRef.current = null
      if (recorderRef.current && recorderRef.current.state !== 'inactive') {
        recorderRef.current.stop()
      }
      setRecording(false)
      void engine.leave()
      localStreamRef.current?.getTracks().forEach((track) => track.stop())
      localStreamRef.current = null
    }
  }, [info])

  const toggleMic = (): void => {
    const next = !micOn
    setMicOn(next)
    const track = localStreamRef.current?.getAudioTracks()[0]
    if (track) track.enabled = next
    engineRef.current?.setMic(next)
  }

  const toggleCam = (): void => {
    const next = !camOn
    setCamOn(next)
    const track = localStreamRef.current?.getVideoTracks()[0]
    if (track) track.enabled = next
    engineRef.current?.setCam(next)
  }

  const toggleScreen = async (): Promise<void> => {
    const engine = engineRef.current
    if (!engine) return
    if (screenActive) {
      engine.stopScreen()
      localScreenRef.current?.getTracks().forEach((track) => track.stop())
      localScreenRef.current = null
      setScreenActive(false)
      return
    }
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true })
      localScreenRef.current = stream
      await engine.startScreen(stream)
      setScreenActive(true)
      stream.getVideoTracks()[0]?.addEventListener('ended', () => {
        engine.stopScreen()
        localScreenRef.current = null
        setScreenActive(false)
      })
    } catch {
      // picker dismissed
    }
  }

  const buildRecordingStream = (): MediaStream | null => {
    const local = localStreamRef.current
    if (!local) return null
    try {
      const ctx = new AudioContext()
      audioCtxRef.current = ctx
      const dest = ctx.createMediaStreamDestination()
      const sources: Array<MediaStream | null> = [local, ...peers.map((peer) => peer.stream)]
      for (const source of sources) {
        if (source && source.getAudioTracks().length > 0) {
          try {
            ctx.createMediaStreamSource(source).connect(dest)
          } catch {
            // stream without usable audio
          }
        }
      }
      const videoTracks = localScreenRef.current
        ? localScreenRef.current.getVideoTracks()
        : local.getVideoTracks()
      return new MediaStream([...videoTracks, ...dest.stream.getAudioTracks()])
    } catch {
      return null
    }
  }

  const startRecording = (): void => {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') return
    const stream = buildRecordingStream()
    if (!stream) return
    const mimeType = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'].find(
      (type) => MediaRecorder.isTypeSupported(type)
    )
    let recorder: MediaRecorder
    try {
      recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream)
    } catch {
      setStatus('Recording is not supported in this browser.')
      return
    }
    const chunks: Blob[] = []
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data)
    }
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: 'video/webm' })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
      const label = (info?.title ?? 'meeting').replace(/[^\w-]+/g, '-').slice(0, 40) || 'meeting'
      anchor.href = url
      anchor.download = `ClientRegit-${label}-${stamp}.webm`
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      setTimeout(() => URL.revokeObjectURL(url), 30000)
      audioCtxRef.current?.close().catch(() => undefined)
      audioCtxRef.current = null
      setStatus('Recording downloaded.')
      setTimeout(() => setStatus(''), 4000)
    }
    recorder.start(1000)
    recorderRef.current = recorder
    recordStartRef.current = Date.now()
    setRecordSeconds(0)
    setRecording(true)
  }

  const stopRecording = (): void => {
    const recorder = recorderRef.current
    if (recorder && recorder.state !== 'inactive') recorder.stop()
    setRecording(false)
  }

  useEffect(() => {
    if (!recording) return
    const timer = setInterval(() => {
      setRecordSeconds(Math.floor((Date.now() - recordStartRef.current) / 1000))
    }, 1000)
    return () => clearInterval(timer)
  }, [recording])

  const sendChat = async (): Promise<void> => {
    const body = chatDraft.trim()
    if (!body || !info?.id) return
    setChatDraft('')
    const { error } = await supabase().from('meeting_messages').insert({
      meeting_id: info.id,
      sender_kind: 'guest',
      sender_id: engineRef.current?.getSelfPeerId() ?? 'guest',
      sender_name: name.trim() || 'Guest',
      body: body.slice(0, 4000)
    })
    if (error) {
      setChatDraft(body)
      setStatus(error.message)
      setTimeout(() => setStatus(''), 4000)
    }
  }

  useEffect(() => {
    if (panel === 'chat') setSeenChat((chat ?? []).length)
  }, [panel, chat])

  const react = (emoji: string): void => {
    pushFloat(emoji)
    engineRef.current?.sendReaction(emoji)
  }

  const visiblePeers = peers.filter((peer) => peer.admitted)
  const screenPeer = visiblePeers.find((peer) => peer.screenOn && peer.screenStream)
  const stageStream = localScreenRef.current ?? screenPeer?.screenStream ?? null
  const inLobby = !!selfState?.waitingInLobby
  const denied = !!selfState?.denied
  const joinUrl = `${window.location.origin}/#/join/${info?.code ?? code}`
  const gridClass =
    visiblePeers.length + 1 <= 1
      ? 'grid-cols-1'
      : visiblePeers.length + 1 === 2
        ? 'grid-cols-2'
        : 'grid-cols-2 lg:grid-cols-3'

  if (info === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas text-sm text-muted">
        Loading meeting…
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="max-w-sm text-sm text-muted">{loadError}</p>
        <button
          onClick={() => void loadRoom()}
          className="cursor-pointer rounded-lg bg-gold px-4 py-2 text-sm font-medium text-white hover:bg-gold-strong"
        >
          Try again
        </button>
      </div>
    )
  }

  if (!info) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-sm font-semibold">Meeting not found</p>
        <p className="max-w-sm text-xs text-muted">
          Check the meeting code {code ? `“${code}”` : ''} and try again.
        </p>
        <Link to="/" className="text-sm font-medium text-gold-strong hover:underline">
          Back to clientregit.vercel.app
        </Link>
      </div>
    )
  }

  if (info.status === 'ended' || info.status === 'cancelled') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-sm font-semibold">
          {info.status === 'cancelled' ? 'This meeting was cancelled.' : 'This meeting has ended.'}
        </p>
        <p className="text-xs text-muted">{info.title}</p>
        <Link to="/" className="text-sm font-medium text-gold-strong hover:underline">
          Back to clientregit.vercel.app
        </Link>
      </div>
    )
  }

  if (left) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-sm font-semibold">You left the call.</p>
        <button
          onClick={() => window.location.reload()}
          className="cursor-pointer rounded-lg border border-line bg-surface px-4 py-2 text-sm font-medium hover:border-gold"
        >
          Rejoin
        </button>
        <Link to="/" className="text-sm font-medium text-gold-strong hover:underline">
          Back to site
        </Link>
      </div>
    )
  }

  if (denied) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-sm font-semibold">The host did not admit you to this meeting.</p>
        <button
          onClick={() => void leaveCall()}
          className="cursor-pointer rounded-lg border border-line bg-surface px-4 py-2 text-sm font-medium hover:border-gold"
        >
          Leave
        </button>
      </div>
    )
  }

  if (mode === 'waiting') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gold/15 text-gold animate-soft-pulse">
          <ClockIcon size={20} />
        </span>
        <p className="text-sm font-semibold">Waiting for the host to start the meeting…</p>
        <p className="text-xs text-muted">
          {info.title}
          {info.scheduled_at ? ` · ${shortWhen(info.scheduled_at)}` : ''}
        </p>
        <p className="text-[11px] text-muted">This screen refreshes automatically.</p>
        <button
          onClick={() => setMode('idle')}
          className="cursor-pointer rounded-lg border border-line bg-surface px-4 py-2 text-sm font-medium hover:border-gold"
        >
          Cancel
        </button>
      </div>
    )
  }

  if (mode === 'idle' || deviceError) {
    const scheduled = info.status === 'scheduled'
    return (
      <div className="flex min-h-screen flex-col">
        <header className="flex items-center gap-3 border-b border-line bg-surface px-4 py-3">
          <Link to="/" className="text-sm font-bold tracking-tight hover:text-gold-strong">
            ClientRegit
          </Link>
          <span className="text-muted">/</span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold">{info.title}</div>
            <div className="text-xs text-muted">
              {scheduled ? `Starts ${shortWhen(info.scheduled_at)}` : 'Meeting is live'}
            </div>
          </div>
          <span
            className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
              scheduled ? 'border-line bg-surface-2 text-muted' : 'border-danger/30 bg-red-50 text-danger'
            }`}
          >
            {info.status}
          </span>
        </header>

        <main className="mx-auto grid w-full max-w-5xl flex-1 grid-cols-1 gap-6 px-6 py-8 lg:grid-cols-2">
          <div className="relative aspect-video overflow-hidden rounded-xl border border-line bg-black">
            {deviceError ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
                <p className="max-w-xs text-sm text-white/80">{deviceError}</p>
                <button
                  onClick={() => {
                    setDeviceError(null)
                    localStreamRef.current = null
                    void setupDevices()
                  }}
                  className="cursor-pointer rounded-lg bg-white/15 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/25"
                >
                  Try again
                </button>
              </div>
            ) : (
              <Surface key={previewTick} stream={localStream} mirrored mutedSelf showMedia={camOn} />
            )}
            <div className="absolute bottom-3 left-3 flex gap-2">
              <button
                onClick={toggleMic}
                className={`cursor-pointer rounded-full p-2.5 ${micOn ? 'bg-white/15 text-white hover:bg-white/25' : 'bg-danger text-white'}`}
                title={micOn ? 'Mute' : 'Unmute'}
              >
                <MicIcon on={micOn} size={16} />
              </button>
              <button
                onClick={toggleCam}
                className={`cursor-pointer rounded-full p-2.5 ${camOn ? 'bg-white/15 text-white hover:bg-white/25' : 'bg-danger text-white'}`}
                title={camOn ? 'Camera off' : 'Camera on'}
              >
                <CamIcon on={camOn} size={16} />
              </button>
            </div>
          </div>

          <div className="space-y-4">
            <h1 className="text-lg font-semibold">Join as a guest</h1>
            <p className="-mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
              <span>Have the ClientRegit app?</span>
              <a
                href={`clientregit://join/${code}`}
                className="font-semibold text-gold-strong hover:underline"
              >
                Open in the desktop app
              </a>
              <span aria-hidden="true">·</span>
              <a href={DOWNLOADS.release} target="_blank" rel="noreferrer" className="hover:underline">
                Download
              </a>
            </p>
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
                Your name <span className="text-danger">*</span>
              </label>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Enter your name"
                maxLength={60}
                autoFocus
                className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-gold"
              />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
                  Camera
                </label>
                <select
                  value={camId}
                  onChange={(event) => {
                    setCamId(event.target.value)
                    void switchDevice(event.target.value, micId)
                  }}
                  className="w-full cursor-pointer rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-gold"
                >
                  {devices.filter((d) => d.kind === 'videoinput').map((device) => (
                    <option key={device.deviceId} value={device.deviceId}>
                      {device.label || 'Camera'}
                    </option>
                  ))}
                  {devices.filter((d) => d.kind === 'videoinput').length === 0 && (
                    <option value="">Default</option>
                  )}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
                  Microphone
                </label>
                <select
                  value={micId}
                  onChange={(event) => {
                    setMicId(event.target.value)
                    void switchDevice(camId, event.target.value)
                  }}
                  className="w-full cursor-pointer rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-gold"
                >
                  {devices.filter((d) => d.kind === 'audioinput').map((device) => (
                    <option key={device.deviceId} value={device.deviceId}>
                      {device.label || 'Microphone'}
                    </option>
                  ))}
                  {devices.filter((d) => d.kind === 'audioinput').length === 0 && (
                    <option value="">Default</option>
                  )}
                </select>
              </div>
            </div>
            {joinError && <p className="text-xs text-danger">{joinError}</p>}
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => void handleJoin()}
                disabled={busy || !!deviceError}
                className="cursor-pointer rounded-lg bg-gold px-5 py-2.5 text-sm font-semibold text-white hover:bg-gold-strong disabled:opacity-50"
              >
                {busy ? 'Joining…' : info.status === 'scheduled' ? 'Join (wait for host)' : 'Join now'}
              </button>
              <Link
                to="/"
                className="rounded-lg border border-line bg-surface px-5 py-2.5 text-sm font-medium hover:border-gold"
              >
                Cancel
              </Link>
            </div>
            <p className="text-xs text-muted">
              {info.host_name ? `${info.host_name} is hosting this meeting. ` : ''}
              {info.lobby_enabled ? 'A waiting room is on — the host will let you in.' : ''}
            </p>
          </div>
        </main>
      </div>
    )
  }

  const tileStream = (peer: CallPeerState): MediaStream | null =>
    peer.screenOn && peer.screenStream ? peer.screenStream : peer.stream

  return (
    <div className="flex h-screen flex-col bg-canvas text-ink">
      <header className="flex items-center gap-3 border-b border-line bg-surface px-4 py-2.5">
        <Link to="/" className="text-sm font-bold tracking-tight hover:text-gold-strong">
          ClientRegit
        </Link>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">{info.title}</div>
          <div className="text-[11px] text-muted">Code {info.code}</div>
        </div>
        {status && <span className="text-xs text-danger">{status}</span>}
        {recording && (
          <span className="flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-1 text-[11px] font-semibold text-danger">
            <span className="h-2 w-2 rounded-full bg-danger animate-soft-pulse" />
            REC {Math.floor(recordSeconds / 60)}:{String(recordSeconds % 60).padStart(2, '0')}
          </span>
        )}
        <button
          onClick={() => {
            void navigator.clipboard
              .writeText(joinUrl)
              .then(() => {
                setStatus('Link copied.')
                setTimeout(() => setStatus(''), 2500)
              })
              .catch(() => {
                setStatus('Copy failed.')
                setTimeout(() => setStatus(''), 2500)
              })
          }}
          className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs font-medium hover:border-gold"
        >
          <CopyIcon size={13} /> Copy link
        </button>
      </header>

      <div className="flex min-h-0 flex-1">
        <main className="flex min-w-0 flex-1 flex-col gap-3 p-4">
          <div className="relative min-h-0 flex-1 rounded-xl border border-line bg-black/90">
            {stageStream ? (
              <Surface stream={stageStream} showMedia />
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-white/40">
                {visiblePeers.length === 0
                  ? 'Waiting for others to join…'
                  : 'No screen share — camera view below'}
              </div>
            )}
            {stageStream && (
              <div className="absolute bottom-2 left-2 rounded bg-black/60 px-2 py-1 text-[11px] text-white">
                {localScreenRef.current ? 'Your screen' : (screenPeer?.name ?? 'Screen')}
              </div>
            )}
            <div className="pointer-events-none absolute right-2 top-2 flex flex-col items-end gap-1">
              {floats.map((float) => (
                <span key={float.id} className="animate-reaction text-4xl">
                  {float.emoji}
                </span>
              ))}
            </div>
          </div>

          <div className={`grid shrink-0 gap-3 ${gridClass}`}>
            <div className="relative aspect-video overflow-hidden rounded-lg border border-line bg-black">
              <Surface key="self" stream={localStream} mirrored mutedSelf showMedia={camOn} />
              <div className="absolute bottom-2 left-2 flex items-center gap-1.5 rounded bg-black/60 px-2 py-1 text-[11px] text-white">
                {name || 'You'} (you)
                {!micOn && <MicIcon on={false} size={12} />}
              </div>
            </div>
            {visiblePeers.map((peer) => (
              <div
                key={peer.peerId}
                className="relative aspect-video overflow-hidden rounded-lg border border-line bg-black"
              >
                <Surface stream={tileStream(peer)} showMedia={peer.camOn || peer.screenOn} />
                <div className="absolute bottom-2 left-2 flex items-center gap-1.5 rounded bg-black/60 px-2 py-1 text-[11px] text-white">
                  <span className="max-w-28 truncate">{peer.name}</span>
                  {peer.isHost && <span className="text-gold">host</span>}
                  {!peer.micOn && <MicIcon on={false} size={12} />}
                </div>
              </div>
            ))}
          </div>

          <footer className="flex flex-wrap items-center justify-center gap-2">
            <CtrlBtn
              active={micOn}
              danger={!micOn}
              onClick={toggleMic}
              label={micOn ? 'Mute' : 'Unmute'}
            >
              <MicIcon on={micOn} size={15} />
            </CtrlBtn>
            <CtrlBtn
              active={camOn}
              danger={!camOn}
              onClick={toggleCam}
              label={camOn ? 'Stop video' : 'Video'}
            >
              <CamIcon on={camOn} size={15} />
            </CtrlBtn>
            <CtrlBtn active={screenActive} onClick={() => void toggleScreen()} label="Share">
              <ScreenIcon size={15} />
            </CtrlBtn>
            <CtrlBtn
              active={recording}
              danger={recording}
              onClick={() => (recording ? stopRecording() : startRecording())}
              label="Record"
            >
              <RecordIcon size={13} />
            </CtrlBtn>
            <CtrlBtn
              active={panel === 'chat'}
              onClick={() => setPanel((current) => (current === 'chat' ? null : 'chat'))}
              label="Chat"
              badge={panel === 'chat' ? 0 : Math.max(0, (chat?.length ?? 0) - seenChat)}
            >
              <ChatIcon size={15} />
            </CtrlBtn>
            <CtrlBtn
              active={panel === 'people'}
              onClick={() => setPanel((current) => (current === 'people' ? null : 'people'))}
              label="People"
            >
              <PeopleIcon size={15} />
            </CtrlBtn>
            <CtrlBtn
              active={reactionBar}
              onClick={() => setReactionBar((open) => !open)}
              label="React"
            >
              <SmileIcon size={15} />
            </CtrlBtn>
            <button
              onClick={() => void leaveCall()}
              className="ml-2 inline-flex cursor-pointer items-center gap-2 rounded-lg bg-danger px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90"
            >
              <LeaveIcon size={16} /> Leave
            </button>
          </footer>

          {reactionBar && (
            <div className="flex items-center justify-center gap-2">
              {REACTIONS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => react(emoji)}
                  className="cursor-pointer rounded-lg border border-line bg-surface px-3 py-1.5 text-xl transition-transform hover:scale-110"
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
        </main>

        {panel && (
          <aside className="flex w-80 shrink-0 flex-col border-l border-line bg-surface">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <span className="text-sm font-semibold">{panel === 'chat' ? 'In-call chat' : 'People'}</span>
              <button
                className="cursor-pointer rounded-md p-1 text-muted hover:bg-surface-2 hover:text-ink"
                onClick={() => setPanel(null)}
              >
                <XIcon size={16} />
              </button>
            </div>
            {panel === 'chat' ? (
              <>
                <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
                  {chat === null ? (
                    <p className="py-8 text-center text-xs text-muted">Loading chat…</p>
                  ) : chat.length === 0 ? (
                    <p className="py-8 text-center text-xs text-muted">No messages yet.</p>
                  ) : (
                    chat.map((message) => (
                      <div key={message.id}>
                        <div className="flex items-baseline gap-2">
                          <span className="text-[11px] font-semibold">{message.sender_name}</span>
                          <span className="text-[10px] text-muted">
                            {new Date(message.created_at).toLocaleTimeString('en-GB', {
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        </div>
                        <p className="whitespace-pre-wrap break-words text-sm">{message.body}</p>
                      </div>
                    ))
                  )}
                </div>
                <div className="flex items-center gap-2 border-t border-line px-3 py-3">
                  <input
                    placeholder="Message everyone"
                    value={chatDraft}
                    onChange={(event) => setChatDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && !event.shiftKey) {
                        event.preventDefault()
                        void sendChat()
                      }
                    }}
                    className="min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-gold"
                  />
                  <button
                    onClick={() => void sendChat()}
                    disabled={!chatDraft.trim()}
                    className="cursor-pointer rounded-lg bg-gold p-2.5 text-white hover:bg-gold-strong disabled:opacity-50"
                    title="Send"
                  >
                    <SendIcon size={15} />
                  </button>
                </div>
              </>
            ) : (
              <div className="flex-1 overflow-y-auto px-3 py-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gold/15 text-xs font-semibold text-gold-strong">
                      {(name || 'G').charAt(0).toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{name || 'You'} (you)</span>
                  </div>
                  {visiblePeers.map((peer) => (
                    <div key={peer.peerId} className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-surface-2 text-xs font-semibold uppercase text-muted">
                        {peer.name.charAt(0).toUpperCase()}
                      </span>
                      <span className="min-w-0 flex-1 truncate">{peer.name}</span>
                      {peer.isHost && (
                        <span className="rounded-full border border-gold/40 bg-gold/10 px-2 py-0.5 text-[10px] font-semibold text-gold-strong">
                          host
                        </span>
                      )}
                      {!peer.micOn && <MicIcon on={false} size={13} />}
                    </div>
                  ))}
                  {visiblePeers.length === 0 && (
                    <p className="px-2 py-4 text-xs text-muted">
                      You are the only one here. Share the link to invite others.
                    </p>
                  )}
                </div>
              </div>
            )}
          </aside>
        )}
      </div>

      {inLobby && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-6">
          <div className="w-full max-w-sm rounded-xl border border-line bg-surface p-6 text-center">
            <span className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-gold/15 text-gold">
              <ClockIcon size={22} />
            </span>
            <p className="text-sm font-semibold">You are in the waiting room</p>
            <p className="mt-1 text-xs text-muted">
              {info.host_name ? `${info.host_name} will let you in shortly.` : 'The host will let you in shortly.'}
            </p>
            <div className="mt-4 flex justify-center">
              <button
                onClick={() => void leaveCall()}
                className="cursor-pointer rounded-lg border border-line bg-surface px-4 py-2 text-sm font-medium hover:border-gold"
              >
                Leave
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function CtrlBtn({
  children,
  label,
  active,
  danger,
  badge,
  onClick
}: {
  children: ReactNode
  label: string
  active?: boolean
  danger?: boolean
  badge?: number
  onClick: () => void
}): ReactNode {
  return (
    <button
      onClick={onClick}
      title={label}
      className={`relative inline-flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${
        danger
          ? 'border-danger bg-danger text-white'
          : active
            ? 'border-gold bg-gold/10 text-gold-strong'
            : 'border-line bg-surface text-muted hover:border-gold hover:text-ink'
      }`}
    >
      {children}
      {label}
      {badge !== undefined && badge > 0 && (
        <span className="absolute -right-1.5 -top-1.5 rounded-full bg-gold px-1 text-[9px] font-bold leading-4 text-white">
          {badge > 9 ? '9+' : badge}
        </span>
      )}
    </button>
  )
}
