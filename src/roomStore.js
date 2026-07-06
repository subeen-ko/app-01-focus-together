import { createClient } from '@supabase/supabase-js'

const STORAGE_KEY = 'focus-together-demo-rooms'
const url = import.meta.env.VITE_SUPABASE_URL
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY
const hasSupabase = Boolean(url && publishableKey && !url.includes('YOUR_'))

function isPrivilegedKey(key) {
  if (!key) return false
  if (key.startsWith('sb_secret_')) return true
  try {
    const payload = JSON.parse(atob(key.split('.')[1]))
    return payload.role === 'service_role'
  } catch {
    return false
  }
}

const unsafeBrowserKey = isPrivilegedKey(publishableKey)
const supabase = hasSupabase && !unsafeBrowserKey ? createClient(url, publishableKey) : null
let authPromise

const clone = (value) => JSON.parse(JSON.stringify(value))
const makeCode = () => Math.random().toString(36).slice(2, 8).toUpperCase()
const nowIso = () => new Date().toISOString()

function getDemoUserId() {
  const saved = localStorage.getItem('focus-together-user-id')
  if (saved) return saved
  const id = crypto.randomUUID()
  localStorage.setItem('focus-together-user-id', id)
  return id
}

async function ensureAuthenticatedUser() {
  if (!hasSupabase) return getDemoUserId()
  if (unsafeBrowserKey) {
    throw new Error('브라우저 환경변수에는 Supabase publishable 키만 사용할 수 있어요.')
  }
  if (!authPromise) {
    authPromise = (async () => {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
      if (sessionError) throw new Error('사용자 세션을 확인하지 못했어요.')
      if (sessionData.session?.user?.id) return sessionData.session.user.id

      const { data, error } = await supabase.auth.signInAnonymously()
      if (error || !data.user?.id) throw new Error('익명 로그인을 사용할 수 없어요. Supabase Auth 설정을 확인해주세요.')
      return data.user.id
    })()
  }
  return authPromise
}

function safeDatabaseError(error, fallback) {
  console.error('[같이집중] database request failed', {
    code: error?.code,
    status: error?.status,
  })
  return new Error(fallback)
}

function readDemoRooms() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
  } catch {
    return []
  }
}

function writeDemoRooms(rooms) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rooms))
  window.dispatchEvent(new CustomEvent('focus-together-change'))
}

function mapRoom(row, participants = [], messages = []) {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    hostId: row.host_id,
    isLocked: row.is_locked,
    phase: row.phase,
    focusSeconds: row.focus_seconds,
    breakSeconds: row.break_seconds,
    timerEndAt: row.timer_end_at,
    cycleCount: row.cycle_count,
    createdAt: row.created_at,
    participants: participants.map((item) => ({
      id: item.id,
      userId: item.user_id,
      nickname: item.nickname,
      task: item.task,
      isReady: item.is_ready,
      isHost: item.is_host,
      joinedAt: item.joined_at,
    })),
    messages: messages.map((item) => ({
      id: item.id,
      userId: item.user_id,
      nickname: item.nickname,
      content: item.content,
      createdAt: item.created_at,
    })),
  }
}

async function getSupabaseRoom(id) {
  await ensureAuthenticatedUser()
  const [{ data: room, error }, { data: participants }, { data: messages }] = await Promise.all([
    supabase.from('rooms').select('*').eq('id', id).maybeSingle(),
    supabase.from('participants').select('*').eq('room_id', id).order('joined_at'),
    supabase.from('messages').select('*').eq('room_id', id).order('created_at').limit(100),
  ])
  if (error) throw safeDatabaseError(error, '방 정보를 불러오지 못했어요.')
  return room ? mapRoom(room, participants || [], messages || []) : null
}

const demoStore = {
  async getUserId() {
    return getDemoUserId()
  },

  async listPublicRooms() {
    return readDemoRooms()
      .filter((room) => !room.isLocked)
      .map((room) => ({ ...clone(room), participantCount: room.participants.length }))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
  },

  async createRoom({ name, pin, focusSeconds, breakSeconds, userId, nickname }) {
    const rooms = readDemoRooms()
    let code = makeCode()
    while (rooms.some((room) => room.code === code)) code = makeCode()
    const room = {
      id: crypto.randomUUID(),
      code,
      name,
      pin,
      hostId: userId,
      isLocked: Boolean(pin),
      phase: 'lobby',
      focusSeconds,
      breakSeconds,
      timerEndAt: null,
      cycleCount: 0,
      createdAt: nowIso(),
      participants: [{
        id: crypto.randomUUID(),
        userId,
        nickname,
        task: '',
        isReady: false,
        isHost: true,
        joinedAt: nowIso(),
      }],
      messages: [],
    }
    rooms.push(room)
    writeDemoRooms(rooms)
    return clone(room)
  },

  async joinRoom({ code, pin, userId, nickname }) {
    const rooms = readDemoRooms()
    const room = rooms.find((item) => item.code === code.toUpperCase())
    if (!room) throw new Error('해당 코드를 가진 방을 찾지 못했어요.')
    if (room.isLocked && room.pin !== pin) throw new Error('잠금 PIN이 맞지 않아요.')
    const existing = room.participants.find((item) => item.userId === userId)
    if (existing) {
      existing.nickname = nickname
    } else {
      room.participants.push({
        id: crypto.randomUUID(),
        userId,
        nickname,
        task: '',
        isReady: false,
        isHost: false,
        joinedAt: nowIso(),
      })
    }
    writeDemoRooms(rooms)
    return clone(room)
  },

  async getRoom(id) {
    return clone(readDemoRooms().find((room) => room.id === id) || null)
  },

  async updateParticipant(roomId, userId, updates) {
    const rooms = readDemoRooms()
    const participant = rooms.find((room) => room.id === roomId)?.participants.find((item) => item.userId === userId)
    if (!participant) throw new Error('참가자 정보를 찾지 못했어요.')
    Object.assign(participant, updates)
    writeDemoRooms(rooms)
  },

  async startFocus(roomId, userId) {
    const rooms = readDemoRooms()
    const room = rooms.find((item) => item.id === roomId)
    if (!room || room.hostId !== userId) throw new Error('호스트만 시작할 수 있어요.')
    if (!room.participants.every((item) => item.isReady)) throw new Error('아직 준비하지 않은 사람이 있어요.')
    room.phase = 'focus'
    room.cycleCount += 1
    room.timerEndAt = new Date(Date.now() + room.focusSeconds * 1000).toISOString()
    writeDemoRooms(rooms)
  },

  async advancePhase(roomId, userId) {
    const rooms = readDemoRooms()
    const room = rooms.find((item) => item.id === roomId)
    if (!room || room.hostId !== userId) throw new Error('호스트만 타이머를 전환할 수 있어요.')
    if (room.phase === 'focus') {
      room.phase = 'break'
      room.timerEndAt = new Date(Date.now() + room.breakSeconds * 1000).toISOString()
    } else {
      room.phase = 'lobby'
      room.timerEndAt = null
      room.participants.forEach((item) => { item.isReady = false })
    }
    writeDemoRooms(rooms)
  },

  async sendMessage(roomId, userId, nickname, content) {
    const rooms = readDemoRooms()
    const room = rooms.find((item) => item.id === roomId)
    if (!room || room.phase !== 'break') throw new Error('채팅은 쉬는 시간에만 열려요.')
    room.messages.push({ id: crypto.randomUUID(), userId, nickname, content, createdAt: nowIso() })
    writeDemoRooms(rooms)
  },

  async leaveRoom(roomId, userId) {
    const rooms = readDemoRooms()
    const index = rooms.findIndex((item) => item.id === roomId)
    if (index < 0) return
    const room = rooms[index]
    room.participants = room.participants.filter((item) => item.userId !== userId)
    if (!room.participants.length) {
      rooms.splice(index, 1)
    } else if (room.hostId === userId) {
      room.hostId = room.participants[0].userId
      room.participants[0].isHost = true
    }
    writeDemoRooms(rooms)
  },

  subscribe(_roomId, callback) {
    const handler = () => callback()
    window.addEventListener('storage', handler)
    window.addEventListener('focus-together-change', handler)
    return () => {
      window.removeEventListener('storage', handler)
      window.removeEventListener('focus-together-change', handler)
    }
  },
}

const supabaseStore = {
  async getUserId() {
    return ensureAuthenticatedUser()
  },

  async listPublicRooms() {
    await ensureAuthenticatedUser()
    const { data, error } = await supabase
      .from('rooms')
      .select('*')
      .eq('is_locked', false)
      .order('created_at', { ascending: false })
      .limit(20)
    if (error) throw safeDatabaseError(error, '공개방 목록을 불러오지 못했어요.')
    return data.map((room) => ({
      ...mapRoom(room),
      participantCount: room.participant_count || 0,
    }))
  },

  async createRoom(settings) {
    await ensureAuthenticatedUser()
    const { data, error } = await supabase.rpc('create_focus_room', {
      p_name: settings.name,
      p_pin: settings.pin || null,
      p_focus_seconds: settings.focusSeconds,
      p_break_seconds: settings.breakSeconds,
      p_nickname: settings.nickname,
    })
    if (error) throw safeDatabaseError(error, '방을 만들지 못했어요. 입력값을 확인하고 잠시 후 다시 시도해주세요.')
    return getSupabaseRoom(data)
  },

  async joinRoom(settings) {
    await ensureAuthenticatedUser()
    const { data, error } = await supabase.rpc('join_focus_room', {
      p_code: settings.code.toUpperCase(),
      p_pin: settings.pin || null,
      p_nickname: settings.nickname,
    })
    if (error) throw safeDatabaseError(error, '방 코드 또는 PIN을 확인해주세요.')
    return getSupabaseRoom(data)
  },

  getRoom: getSupabaseRoom,

  async updateParticipant(roomId, _userId, updates) {
    await ensureAuthenticatedUser()
    const { error } = await supabase.rpc('update_focus_participant', {
      p_room_id: roomId,
      p_task: 'task' in updates ? updates.task : null,
      p_is_ready: 'isReady' in updates ? updates.isReady : null,
    })
    if (error) throw safeDatabaseError(error, '참가자 상태를 저장하지 못했어요.')
  },

  async startFocus(roomId) {
    await ensureAuthenticatedUser()
    const { error } = await supabase.rpc('start_focus_session', { p_room_id: roomId })
    if (error) throw safeDatabaseError(error, '모두 준비됐는지 확인해주세요.')
  },

  async advancePhase(roomId) {
    await ensureAuthenticatedUser()
    const { error } = await supabase.rpc('advance_focus_phase', { p_room_id: roomId })
    if (error) throw safeDatabaseError(error, '타이머를 전환하지 못했어요.')
  },

  async sendMessage(roomId, _userId, _nickname, content) {
    await ensureAuthenticatedUser()
    const { error } = await supabase.rpc('send_focus_message', {
      p_room_id: roomId,
      p_content: content,
    })
    if (error) throw safeDatabaseError(error, '메시지를 보내지 못했어요.')
  },

  async leaveRoom(roomId) {
    await ensureAuthenticatedUser()
    const { error } = await supabase.rpc('leave_focus_room', { p_room_id: roomId })
    if (error) throw safeDatabaseError(error, '방에서 나가지 못했어요.')
  },

  subscribe(_roomId, callback) {
    const channel = supabase
      .channel('focus-together-app')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms' }, callback)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'participants' }, callback)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, callback)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  },
}

export const roomStore = {
  ...(hasSupabase ? supabaseStore : demoStore),
  backendLabel: hasSupabase ? '실시간 연결됨' : '데모 모드',
}
