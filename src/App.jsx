import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ArrowLeft,
  Check,
  ChevronRight,
  Clock3,
  Copy,
  Dumbbell,
  Flame,
  LockKeyhole,
  MessageCircle,
  Play,
  Plus,
  Send,
  Settings2,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  TimerReset,
  Unlock,
  UserRound,
  UsersRound,
  Zap,
} from 'lucide-react'
import { roomStore } from './roomStore.js'

const DEFAULT_FOCUS_SECONDS = 25 * 60
const DEFAULT_BREAK_SECONDS = 5 * 60
function formatTime(totalSeconds) {
  const safeSeconds = Math.max(0, totalSeconds)
  const minutes = Math.floor(safeSeconds / 60)
  const seconds = safeSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

function formatClock(value) {
  return new Intl.DateTimeFormat('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function DurationField({ label, seconds, setSeconds, maxSeconds }) {
  const [unit, setUnit] = useState(60)
  const amount = seconds ? Math.round((seconds / unit) * 100) / 100 : ''
  const minimum = unit === 1 ? 10 : 1
  const maximum = Math.max(minimum, Math.floor(maxSeconds / unit))

  return (
    <label className="field">
      <span>{label}</span>
      <div className="duration-input">
        <input
          type="number"
          inputMode="decimal"
          min={minimum}
          max={maximum}
          value={amount}
          onChange={(event) => {
            const value = Number(event.target.value)
            setSeconds(Math.min(maxSeconds, Math.max(0, Math.round(value * unit))))
          }}
        />
        <select
          value={unit}
          onChange={(event) => {
            const nextUnit = Number(event.target.value)
            setUnit(nextUnit)
          }}
        >
          <option value={1}>초</option>
          <option value={60}>분</option>
          <option value={3600}>시간</option>
        </select>
      </div>
    </label>
  )
}

function HomeScreen({ nickname, setNickname, onCreate, onJoin, rooms, backendLabel }) {
  const [view, setView] = useState('home')
  const [roomName, setRoomName] = useState('')
  const [roomCode, setRoomCode] = useState('')
  const [pin, setPin] = useState('')
  const [isLocked, setIsLocked] = useState(false)
  const [focusSeconds, setFocusSeconds] = useState(DEFAULT_FOCUS_SECONDS)
  const [breakSeconds, setBreakSeconds] = useState(DEFAULT_BREAK_SECONDS)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const run = async (action) => {
    setError('')
    if (!nickname.trim()) {
      setError('먼저 사용할 닉네임을 적어주세요.')
      return
    }
    setBusy(true)
    try {
      await action()
    } catch (err) {
      setError(err.message || '잠시 후 다시 시도해주세요.')
    } finally {
      setBusy(false)
    }
  }

  if (view === 'create') {
    return (
      <main className="app-shell narrow-shell">
        <button className="back-button" onClick={() => setView('home')}>
          <ArrowLeft size={18} /> 돌아가기
        </button>
        <section className="card create-card">
          <div className="eyebrow"><Plus size={16} /> 새 집중방</div>
          <h1>우리, 일단 시작해요</h1>
          <p className="lead">각자 할 일을 들고 모여 같은 타이머로 달립니다.</p>

          <label className="field">
            <span>방 이름</span>
            <input
              autoFocus
              value={roomName}
              onChange={(event) => setRoomName(event.target.value)}
              placeholder="예: 밀린 일 해치우는 밤"
              maxLength={40}
            />
          </label>

          <div className="form-grid">
            <DurationField label="집중 시간" seconds={focusSeconds} setSeconds={setFocusSeconds} maxSeconds={2 * 60 * 60} />
            <DurationField label="쉬는 시간" seconds={breakSeconds} setSeconds={setBreakSeconds} maxSeconds={60 * 60} />
          </div>

          <button className={`lock-toggle ${isLocked ? 'active' : ''}`} onClick={() => setIsLocked(!isLocked)}>
            {isLocked ? <LockKeyhole size={20} /> : <Unlock size={20} />}
            <span>
              <strong>{isLocked ? '잠금방' : '공개방'}</strong>
              <small>{isLocked ? '입장할 때 4자리 PIN이 필요해요' : '누구나 방 목록에서 들어올 수 있어요'}</small>
            </span>
            <span className="switch" aria-hidden="true"><i /></span>
          </button>

          {isLocked && (
            <label className="field">
              <span>입장 PIN</span>
              <input
                inputMode="numeric"
                value={pin}
                onChange={(event) => setPin(event.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder="숫자 4자리"
              />
            </label>
          )}

          {error && <p className="form-error">{error}</p>}
          <button
            className="primary-button"
            disabled={busy}
            onClick={() => run(() => {
              if (!roomName.trim()) throw new Error('방 이름을 적어주세요.')
              if (isLocked && pin.length !== 4) throw new Error('PIN은 숫자 4자리로 정해주세요.')
              return onCreate({ name: roomName.trim(), pin: isLocked ? pin : '', focusSeconds, breakSeconds })
            })}
          >
            {busy ? '방 만드는 중…' : '방 만들기'} <ChevronRight size={20} />
          </button>
        </section>
      </main>
    )
  }

  if (view === 'join') {
    return (
      <main className="app-shell narrow-shell">
        <button className="back-button" onClick={() => setView('home')}>
          <ArrowLeft size={18} /> 돌아가기
        </button>
        <section className="card create-card">
          <div className="eyebrow"><UsersRound size={16} /> 코드로 입장</div>
          <h1>친구들이 기다려요</h1>
          <p className="lead">공유받은 6자리 방 코드와 잠금 PIN을 입력하세요.</p>
          <label className="field">
            <span>방 코드</span>
            <input
              autoFocus
              className="code-input"
              value={roomCode}
              onChange={(event) => setRoomCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
              placeholder="ABC123"
            />
          </label>
          <label className="field">
            <span>잠금 PIN <em>공개방은 비워두세요</em></span>
            <input
              inputMode="numeric"
              value={pin}
              onChange={(event) => setPin(event.target.value.replace(/\D/g, '').slice(0, 4))}
              placeholder="숫자 4자리"
              onKeyDown={(event) => event.key === 'Enter' && run(() => onJoin(roomCode, pin))}
            />
          </label>
          {error && <p className="form-error">{error}</p>}
          <button className="primary-button" disabled={busy} onClick={() => run(() => onJoin(roomCode, pin))}>
            {busy ? '입장하는 중…' : '입장하기'} <ChevronRight size={20} />
          </button>
        </section>
      </main>
    )
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#" aria-label="같이집중 홈">
          <span><Zap size={20} fill="currentColor" /></span>
          같이집중
        </a>
        <span className="backend-badge">{backendLabel}</span>
      </header>

      <section className="hero">
        <div className="hero-copy">
          <div className="eyebrow"><Sparkles size={16} /> ADHD를 위한 소셜 집중 타이머</div>
          <h1>혼자 미루지 말고,<br /><em>같이 시작해요.</em></h1>
          <p>각자 할 일은 달라도 타이머는 하나. 레디하고, 몰입하고, 쉬는 시간엔 수다도 떨어요.</p>
          <label className="field nickname-field">
            <span>내 닉네임</span>
            <div className="input-with-icon">
              <UserRound size={19} />
              <input
                value={nickname}
                onChange={(event) => setNickname(event.target.value)}
                placeholder="어떻게 불러드릴까요?"
                maxLength={16}
              />
            </div>
          </label>
          <div className="hero-actions">
            <button className="primary-button" onClick={() => setView('create')}>
              <Plus size={20} /> 방 만들기
            </button>
            <button className="secondary-button" onClick={() => setView('join')}>
              코드로 입장
            </button>
          </div>
        </div>
        <div className="focus-preview" aria-hidden="true">
          <div className="preview-orbit orbit-one" />
          <div className="preview-orbit orbit-two" />
          <span className="preview-label"><Flame size={16} /> FOCUS</span>
          <strong>24:37</strong>
          <p>논문 서론 초안 쓰기</p>
          <div className="preview-avatars">
            <i>나</i><i>밍</i><i>해</i><i>+2</i>
          </div>
        </div>
      </section>

      <section className="rooms-section">
        <div className="section-heading">
          <div>
            <span className="live-dot" /> 지금 열려 있는 공개방
          </div>
          <small>{rooms.length}개 방</small>
        </div>
        <div className="room-list">
          {rooms.length === 0 ? (
            <div className="empty-room">
              <Clock3 size={24} />
              <p>아직 열린 방이 없어요. 첫 방의 호스트가 되어보세요!</p>
            </div>
          ) : rooms.map((room) => (
            <button
              className="room-row"
              key={room.id}
              onClick={() => run(() => onJoin(room.code, ''))}
            >
              <span className={`room-icon ${room.phase}`}><Flame size={20} /></span>
              <span className="room-summary">
                <strong>{room.name}</strong>
                <small>{room.phase === 'focus' ? '집중 중' : room.phase === 'break' ? '쉬는 중' : '시작 준비 중'}</small>
              </span>
              <span className="room-meta"><UsersRound size={16} /> {room.participantCount || 1}</span>
              <ChevronRight size={19} />
            </button>
          ))}
        </div>
      </section>
    </main>
  )
}

function ParticipantCard({ participant, isMe, isFocus }) {
  return (
    <article className={`participant ${participant.isReady ? 'ready' : ''}`}>
      <div className="avatar">{participant.nickname.slice(0, 1)}</div>
      <div className="participant-copy">
        <div>
          <strong>{participant.nickname}{isMe && <small> 나</small>}</strong>
          {participant.isHost && <span className="host-tag">HOST</span>}
        </div>
        <p>{participant.task || '아직 할 일을 정하는 중…'}</p>
      </div>
      <span className="ready-state">
        {isFocus ? <Flame size={18} /> : participant.isReady ? <><Check size={17} /> READY</> : '대기'}
      </span>
    </article>
  )
}

function RoomScreen({ room, userId, onLeave, onRefresh }) {
  const me = room.participants.find((participant) => participant.userId === userId)
  const [task, setTask] = useState(me?.task || '')
  const [message, setMessage] = useState('')
  const [now, setNow] = useState(Date.now())
  const [copied, setCopied] = useState(false)
  const [guardEnabled, setGuardEnabled] = useState(() => localStorage.getItem('focus-together-guard') !== 'off')
  const [distractionCount, setDistractionCount] = useState(0)
  const messageEndRef = useRef(null)
  const isHost = Boolean(me?.isHost)
  const phase = room.phase
  const isSession = phase === 'focus' || phase === 'break'
  const duration = phase === 'focus' ? room.focusSeconds : room.breakSeconds
  const secondsLeft = room.timerEndAt
    ? Math.max(0, Math.ceil((new Date(room.timerEndAt).getTime() - now) / 1000))
    : duration
  const progress = duration ? Math.max(0, Math.min(100, (secondsLeft / duration) * 100)) : 0
  const readyCount = room.participants.filter((participant) => participant.isReady).length
  const everyoneReady = room.participants.length > 0 && readyCount === room.participants.length

  useEffect(() => {
    if (!isSession) return undefined
    const interval = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(interval)
  }, [isSession])

  useEffect(() => {
    setNow(Date.now())
    if (phase === 'focus') setDistractionCount(0)
  }, [phase, room.timerEndAt])

  useEffect(() => {
    if (phase !== 'focus' || !guardEnabled) return undefined
    const noticeDistraction = () => {
      if (document.hidden) setDistractionCount((count) => count + 1)
    }
    document.addEventListener('visibilitychange', noticeDistraction)
    return () => document.removeEventListener('visibilitychange', noticeDistraction)
  }, [guardEnabled, phase])

  useEffect(() => {
    if (isHost && isSession && secondsLeft === 0) {
      roomStore.advancePhase(room.id, userId).then(onRefresh).catch(console.error)
    }
  }, [isHost, isSession, onRefresh, room.id, secondsLeft, userId])

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [room.messages.length])

  const saveTask = async () => {
    await roomStore.updateParticipant(room.id, userId, { task: task.trim() })
    onRefresh()
  }

  const toggleReady = async () => {
    await roomStore.updateParticipant(room.id, userId, {
      task: task.trim(),
      isReady: !me.isReady,
    })
    onRefresh()
  }

  const sendMessage = async () => {
    if (!message.trim()) return
    await roomStore.sendMessage(room.id, userId, me.nickname, message.trim())
    setMessage('')
    onRefresh()
  }

  const copyCode = async () => {
    await navigator.clipboard.writeText(room.code)
    setCopied(true)
    setTimeout(() => setCopied(false), 1400)
  }

  if (isSession) {
    const isBreak = phase === 'break'
    return (
      <main className={`session-screen ${isBreak ? 'break-mode' : ''}`}>
        <header className="session-topbar">
          <button className="brand compact" onClick={onLeave}><span><Zap size={18} fill="currentColor" /></span>같이집중</button>
          <div className="session-room-name"><span className="live-dot" /> {room.name}</div>
          <button className="icon-button" title="방 나가기" onClick={onLeave}><ArrowLeft size={19} /></button>
        </header>

        <div className="session-layout">
          <section className="timer-stage">
            <span className={`phase-pill ${phase}`}>
              {isBreak ? <MessageCircle size={17} /> : <Flame size={17} />}
              {isBreak ? 'BREAK · 잠깐 쉬어요' : `FOCUS · ${room.cycleCount || 1}번째 집중`}
            </span>
            <div className="timer-ring" style={{ '--progress': `${progress * 3.6}deg` }}>
              <div>
                <span>{isBreak ? '다음 집중까지' : '남은 집중 시간'}</span>
                <strong>{formatTime(secondsLeft)}</strong>
                <p>{isBreak ? '몸을 움직이고 물 한 잔 어때요?' : me.task || '지금 할 일에만 집중해요'}</p>
              </div>
            </div>

            {!isBreak && guardEnabled && (
              <div className={`guard-status ${distractionCount ? 'distracted' : ''}`}>
                {distractionCount ? <ShieldAlert size={17} /> : <ShieldCheck size={17} />}
                <span>
                  <strong>{distractionCount ? `집중 이탈 ${distractionCount}회` : '집중 수호 중'}</strong>
                  <small>{distractionCount ? '괜찮아요. 다시 돌아온 지금부터 이어가요.' : '이대로 끝내면 퍼펙트 세션!'}</small>
                </span>
              </div>
            )}

            {isHost && (
              <button className="skip-button" onClick={async () => {
                await roomStore.advancePhase(room.id, userId)
                onRefresh()
              }}>
                <TimerReset size={18} /> {isBreak ? '쉬는 시간 끝내기' : '집중 일찍 마치기'}
              </button>
            )}

            <div className="mini-participants">
              {room.participants.map((participant) => (
                <span key={participant.userId} title={`${participant.nickname}: ${participant.task}`}>
                  {participant.nickname.slice(0, 1)}
                </span>
              ))}
              <small>{room.participants.length}명 함께하는 중</small>
            </div>
          </section>

          <aside className={`side-panel ${isBreak ? '' : 'muted-panel'}`}>
            <div className="side-panel-heading">
              <div>
                <MessageCircle size={20} />
                <strong>쉬는 시간 채팅</strong>
              </div>
              {!isBreak && <span>집중 중 잠금</span>}
            </div>
            <div className="messages">
              {room.messages.length === 0 ? (
                <div className="empty-chat">
                  <MessageCircle size={28} />
                  <p>{isBreak ? '첫 메시지를 남겨보세요!' : '채팅은 쉬는 시간에 열려요.'}</p>
                </div>
              ) : room.messages.map((item) => (
                <div className={`message ${item.userId === userId ? 'mine' : ''}`} key={item.id}>
                  <div><strong>{item.nickname}</strong><time>{formatClock(item.createdAt)}</time></div>
                  <p>{item.content}</p>
                </div>
              ))}
              <div ref={messageEndRef} />
            </div>
            <div className="chat-input">
              <input
                disabled={!isBreak}
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                onKeyDown={(event) => event.key === 'Enter' && sendMessage()}
                placeholder={isBreak ? '메시지 보내기' : '집중이 끝나면 만나요'}
                maxLength={300}
              />
              <button disabled={!isBreak || !message.trim()} onClick={sendMessage}><Send size={18} /></button>
            </div>
          </aside>
        </div>
      </main>
    )
  }

  return (
    <main className="app-shell room-shell">
      <header className="topbar">
        <button className="brand" onClick={onLeave}><span><Zap size={20} fill="currentColor" /></span>같이집중</button>
        <button className="secondary-button small" onClick={onLeave}><ArrowLeft size={17} /> 나가기</button>
      </header>

      <section className="room-header">
        <div>
          <div className="eyebrow"><span className="live-dot" /> WAITING ROOM</div>
          <h1>{room.name}</h1>
          <p>할 일을 적고 준비가 되면 레디를 눌러주세요.</p>
        </div>
        <button className="room-code" onClick={copyCode}>
          <span>{room.isLocked ? <LockKeyhole size={16} /> : <Unlock size={16} />} 방 코드</span>
          <strong>{room.code}</strong>
          <small>{copied ? '복사됐어요!' : <><Copy size={14} /> 복사</>}</small>
        </button>
      </section>

      <div className="lobby-grid">
        <section className="card task-card">
          <div className="card-title"><span><Dumbbell size={20} /></span><div><strong>이번 세션에 할 일</strong><small>작고 구체적일수록 시작하기 쉬워요</small></div></div>
          <div className="task-compose">
            <input
              value={task}
              onChange={(event) => setTask(event.target.value)}
              onBlur={saveTask}
              onKeyDown={(event) => event.key === 'Enter' && saveTask()}
              placeholder="예: 스쿼트 3세트 / 보고서 첫 문단"
              maxLength={80}
            />
          </div>
          <div className="session-settings">
            <div><Clock3 size={18} /><span>집중<strong>{Math.round(room.focusSeconds / 60)}분</strong></span></div>
            <div><TimerReset size={18} /><span>휴식<strong>{Math.round(room.breakSeconds / 60)}분</strong></span></div>
            <button
              className={`guard-toggle ${guardEnabled ? 'active' : ''}`}
              onClick={() => {
                const next = !guardEnabled
                setGuardEnabled(next)
                localStorage.setItem('focus-together-guard', next ? 'on' : 'off')
              }}
            >
              <ShieldCheck size={18} />
              <span>집중 수호<strong>{guardEnabled ? '켜짐' : '꺼짐'}</strong></span>
            </button>
          </div>
          <button className={`ready-button ${me?.isReady ? 'is-ready' : ''}`} onClick={toggleReady}>
            {me?.isReady ? <><Check size={22} /> 준비 완료!</> : <><Zap size={22} /> 레디고!</>}
          </button>
        </section>

        <section className="card people-card">
          <div className="people-heading">
            <div><UsersRound size={20} /><strong>함께하는 사람</strong></div>
            <span>{readyCount}/{room.participants.length} 준비</span>
          </div>
          <div className="participant-list">
            {room.participants.map((participant) => (
              <ParticipantCard
                key={participant.userId}
                participant={participant}
                isMe={participant.userId === userId}
                isFocus={false}
              />
            ))}
          </div>
          {isHost ? (
            <button
              className="primary-button start-button"
              disabled={!everyoneReady}
              onClick={async () => {
                await roomStore.startFocus(room.id, userId)
                onRefresh()
              }}
            >
              <Play size={20} fill="currentColor" />
              {everyoneReady ? '모두 준비! 집중 시작' : `${room.participants.length - readyCount}명 준비 기다리는 중`}
            </button>
          ) : (
            <p className="host-wait"><Settings2 size={17} /> 호스트가 타이머를 시작할 거예요.</p>
          )}
        </section>
      </div>
    </main>
  )
}

export default function App() {
  const [userId, setUserId] = useState(null)
  const [startupError, setStartupError] = useState('')
  const [nickname, setNicknameState] = useState(() => localStorage.getItem('focus-together-nickname') || '')
  const [rooms, setRooms] = useState([])
  const [room, setRoom] = useState(null)
  const roomIdRef = useRef(null)

  const setNickname = (value) => {
    setNicknameState(value)
    localStorage.setItem('focus-together-nickname', value)
  }

  const refreshRooms = useCallback(async () => {
    const list = await roomStore.listPublicRooms()
    setRooms(list)
  }, [])

  const refreshRoom = useCallback(async () => {
    if (!roomIdRef.current) return
    const nextRoom = await roomStore.getRoom(roomIdRef.current)
    if (nextRoom) setRoom(nextRoom)
  }, [])

  useEffect(() => {
    roomStore.getUserId()
      .then(setUserId)
      .then(refreshRooms)
      .catch(() => setStartupError('안전한 사용자 세션을 만들지 못했어요. 잠시 후 새로고침해주세요.'))
  }, [refreshRooms])

  useEffect(() => {
    if (!userId) return undefined
    const unsubscribe = roomStore.subscribe(null, () => {
      refreshRooms().catch(console.error)
      refreshRoom().catch(console.error)
    })
    return unsubscribe
  }, [refreshRoom, refreshRooms, userId])

  const enterRoom = (nextRoom) => {
    roomIdRef.current = nextRoom.id
    setRoom(nextRoom)
  }

  const createRoom = async (settings) => {
    const created = await roomStore.createRoom({ ...settings, userId, nickname: nickname.trim() })
    enterRoom(created)
  }

  const joinRoom = async (code, pin) => {
    if (!code.trim()) throw new Error('방 코드를 입력해주세요.')
    const joined = await roomStore.joinRoom({ code: code.trim(), pin, userId, nickname: nickname.trim() })
    enterRoom(joined)
  }

  const leaveRoom = async () => {
    if (room) await roomStore.leaveRoom(room.id, userId)
    roomIdRef.current = null
    setRoom(null)
    refreshRooms().catch(console.error)
  }

  if (startupError) {
    return <main className="startup-state"><ShieldAlert size={28} /><strong>{startupError}</strong></main>
  }

  if (!userId) {
    return <main className="startup-state"><ShieldCheck size={28} /><strong>안전한 세션을 준비하는 중…</strong></main>
  }

  return room ? (
    <RoomScreen room={room} userId={userId} onLeave={leaveRoom} onRefresh={refreshRoom} />
  ) : (
    <HomeScreen
      nickname={nickname}
      setNickname={setNickname}
      onCreate={createRoom}
      onJoin={joinRoom}
      rooms={rooms}
      backendLabel={roomStore.backendLabel}
    />
  )
}
