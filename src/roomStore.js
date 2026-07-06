import { createClient } from '@supabase/supabase-js'

const STORAGE_KEY = 'focus-together-demo-rooms'
const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
const hasSupabase = Boolean(url && anonKey && !url.includes('YOUR_'))
const supabase = hasSupabase ? createClient(url, anonKey) : null

const clone = (value) => JSON.parse(JSON.stringify(value))
const makeCode = () => Math.random().toString(36).slice(2, 8).toUpperCase()
const nowIso = () => new Date().toISOString()

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
  const [{ data: room, error }, { data: participants }, { data: messages }] = await Promise.all([
    supabase.from('rooms').select('*').eq('id', id).maybeSingle(),
    supabase.from('participants').select('*').eq('room_id', id).order('joined_at'),
    supabase.from('messages').select('*').eq('room_id', id).order('created_at').limit(100),
  ])
  if (error) throw error
  return room ? mapRoom(room, participants || [], messages || []) : null
}

const demoStore = {
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
  async listPublicRooms() {
    const { data, error } = await supabase
      .from('rooms')
      .select('*, participants(count)')
      .eq('is_locked', false)
      .order('created_at', { ascending: false })
      .limit(20)
    if (error) throw error
    return data.map((room) => ({
      ...mapRoom(room),
      participantCount: room.participants?.[0]?.count || 0,
    }))
  },

  async createRoom(settings) {
    const { data, error } = await supabase.rpc('create_focus_room', {
      p_name: settings.name,
      p_pin: settings.pin || null,
      p_focus_seconds: settings.focusSeconds,
      p_break_seconds: settings.breakSeconds,
      p_user_id: settings.userId,
      p_nickname: settings.nickname,
    })
    if (error) throw error
    return getSupabaseRoom(data)
  },

  async joinRoom(settings) {
    const { data, error } = await supabase.rpc('join_focus_room', {
      p_code: settings.code.toUpperCase(),
      p_pin: settings.pin || null,
      p_user_id: settings.userId,
      p_nickname: settings.nickname,
    })
    if (error) throw new Error(error.message.includes('PIN') ? '잠금 PIN이 맞지 않아요.' : error.message)
    return getSupabaseRoom(data)
  },

  getRoom: getSupabaseRoom,

  async updateParticipant(roomId, userId, updates) {
    const values = {}
    if ('task' in updates) values.task = updates.task
    if ('isReady' in updates) values.is_ready = updates.isReady
    const { error } = await supabase.from('participants').update(values).eq('room_id', roomId).eq('user_id', userId)
    if (error) throw error
  },

  async startFocus(roomId, userId) {
    const { error } = await supabase.rpc('start_focus_session', { p_room_id: roomId, p_user_id: userId })
    if (error) throw error
  },

  async advancePhase(roomId, userId) {
    const { error } = await supabase.rpc('advance_focus_phase', { p_room_id: roomId, p_user_id: userId })
    if (error) throw error
  },

  async sendMessage(roomId, userId, nickname, content) {
    const room = await getSupabaseRoom(roomId)
    if (room.phase !== 'break') throw new Error('채팅은 쉬는 시간에만 열려요.')
    const { error } = await supabase.from('messages').insert({
      room_id: roomId,
      user_id: userId,
      nickname,
      content,
    })
    if (error) throw error
  },

  async leaveRoom(roomId, userId) {
    const { error } = await supabase.rpc('leave_focus_room', { p_room_id: roomId, p_user_id: userId })
    if (error) throw error
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
