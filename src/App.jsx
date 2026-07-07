import React, { useEffect, useRef, useState } from 'react';

let sharedAudioContext;

function getAudioContext() {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return null;

  if (!sharedAudioContext) {
    sharedAudioContext = new AudioContext();
  }

  if (sharedAudioContext.state === 'suspended') {
    sharedAudioContext.resume();
  }
  return sharedAudioContext;
}

// Global AudioContext for mobile compatibility
let globalAudioCtx = null;

function initAudio() {
  try {
    if (!globalAudioCtx) {
      globalAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (globalAudioCtx.state === 'suspended') {
      globalAudioCtx.resume();
    }
    
    // Play a silent sound to force iOS Safari to unlock AudioContext
    const oscillator = globalAudioCtx.createOscillator();
    const gainNode = globalAudioCtx.createGain();
    
    gainNode.gain.value = 0; // Silent
    oscillator.connect(gainNode);
    gainNode.connect(globalAudioCtx.destination);
    
    oscillator.start();
    oscillator.stop(globalAudioCtx.currentTime + 0.001);
  } catch(e) {
    console.error('Audio initialization failed', e);
  }
}

function playRetroBeep(frequency = 880, duration = 150) {
  try {
    if (!globalAudioCtx) initAudio();
    
    const oscillator = globalAudioCtx.createOscillator();
    const gainNode = globalAudioCtx.createGain();
    
    oscillator.type = 'square';
    oscillator.frequency.setValueAtTime(frequency, globalAudioCtx.currentTime);
    
    gainNode.gain.setValueAtTime(0.1, globalAudioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.00001, globalAudioCtx.currentTime + duration/1000);
    
    oscillator.connect(gainNode);
    gainNode.connect(globalAudioCtx.destination);
    
    oscillator.start();
    oscillator.stop(globalAudioCtx.currentTime + duration/1000);
  } catch(e) {
    console.error('AudioContext not supported or blocked', e);
  }
}

function playTone(frequency = 880, duration = 90, startOffset = 0, volume = 0.08) {
  playRetroBeep(frequency, duration);
}

function playTickSound() {
  playTone(920, 75, 0, 0.06);
}

function playFinalRing() {
  playTone(1040, 120, 0, 0.08);
  playTone(1320, 180, 0.13, 0.08);
}

function formatTime(totalSeconds) {
  const safeSeconds = Math.max(0, totalSeconds);
  const h = Math.floor(safeSeconds / 3600);
  const m = Math.floor((safeSeconds % 3600) / 60);
  const s = safeSeconds % 60;

  if (h > 0) {
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function App() {
  const [focusInput, setFocusInput] = useState(0);
  const [breakInput, setBreakInput] = useState(0);
  const [setsInput, setSetsInput] = useState(5);
  const [activeInput, setActiveInput] = useState('focus');
  const [soundMode, setSoundMode] = useState('5s'); // '5s', 'all', 'off'

  const [phase, setPhase] = useState('idle');
  const [endTime, setEndTime] = useState(null);
  const [currentSet, setCurrentSet] = useState(1);
  const [countdownStep, setCountdownStep] = useState(null);
  const [now, setNow] = useState(Date.now());

  const lastTickedSecond = useRef(null);
  const lastBeepedSecond = useRef(null);

  useEffect(() => {
    if (phase === 'idle' || phase === 'clear' || countdownStep) return undefined;

    const interval = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(interval);
  }, [phase, countdownStep]);

  let secondsLeft = phase === 'idle' ? focusInput : 0;
  if (endTime && now < endTime) {
    secondsLeft = Math.max(0, Math.ceil((endTime - now) / 1000));
  }

  let exactProgress = 0;
  if ((phase === 'focus' || phase === 'break') && endTime) {
    const totalMs = (phase === 'focus' ? focusInput : breakInput) * 1000;
    if (totalMs > 0) {
      const msLeft = Math.max(0, endTime - now);
      exactProgress = 1 - (msLeft / totalMs);
    }
  }

  useEffect(() => {
    if (phase === 'idle' || phase === 'clear' || !endTime) return;

    if (now >= endTime) {
      if (soundMode !== 'off') playFinalRing();
      lastTickedSecond.current = null;
      lastBeepedSecond.current = null;

      if (phase === 'focus') {
        if (currentSet >= setsInput) {
          setPhase('clear');
          setEndTime(null);
          setTimeout(() => {
            setPhase('idle');
            setCurrentSet(1);
          }, 2000);
        } else if (breakInput > 0) {
          setPhase('break');
          setEndTime(Date.now() + breakInput * 1000);
        } else {
          setCurrentSet((set) => set + 1);
          setEndTime(Date.now() + focusInput * 1000);
        }
      } else if (phase === 'break') {
        setPhase('focus');
        setCurrentSet((set) => set + 1);
        setEndTime(Date.now() + focusInput * 1000);
      }
    } else if (secondsLeft > 0 && lastTickedSecond.current !== secondsLeft) {
      lastTickedSecond.current = secondsLeft;
      
      if (soundMode === 'all') {
        playRetroBeep(880, 100);
      } else if (soundMode === '5s') {
        if (secondsLeft <= 5) {
          playRetroBeep(880, 100);
        }
      }
      // 'off'일 때는 아무 소리도 내지 않음 (조용히 카운트다운)
    }
  }, [now, endTime, phase, currentSet, setsInput, focusInput, breakInput, secondsLeft, soundMode]);

  const startTimer = () => {
    initAudio(); 
    
    const focusSeconds = focusInput > 0 ? focusInput : 30;
    const currentTime = Date.now();
    const startTime = currentTime + 1000;

    setFocusInput(focusSeconds);
    setNow(currentTime);
    setCountdownStep('START!');
    setEndTime(startTime + focusSeconds * 1000);
    setCurrentSet(1);
    setPhase('focus');
    lastTickedSecond.current = null;
    lastBeepedSecond.current = null;
    if (soundMode !== 'off') playTickSound();

    setTimeout(() => {
      setNow(Date.now());
      setCountdownStep(null);
    }, 1000);
  };

  const stopTimer = () => {
    setPhase('idle');
    setEndTime(null);
    setCurrentSet(1);
    setCountdownStep(null);
    lastTickedSecond.current = null;
    lastBeepedSecond.current = null;
  };

  const addTime = (seconds) => {
    if (activeInput === 'focus') setFocusInput((prev) => prev + seconds);
    if (activeInput === 'break') setBreakInput((prev) => prev + seconds);
  };

  const clearTime = () => {
    if (activeInput === 'focus') setFocusInput(0);
    if (activeInput === 'break') setBreakInput(0);
  };

  let statusText = 'PLAN GAME';
  if (countdownStep) statusText = countdownStep;
  else if (phase === 'focus') statusText = `SET ${currentSet}/${setsInput} : FOCUS!`;
  else if (phase === 'break') statusText = `SET ${currentSet}/${setsInput} : BREAK!`;
  else if (phase === 'clear') statusText = 'CLEAR!!';

  let boxBorderColor = 'var(--border)';
  if (phase === 'focus') boxBorderColor = 'var(--accent-pink)';
  if (phase === 'break') boxBorderColor = '#00FFCC';
  if (phase === 'clear') boxBorderColor = 'var(--accent-yellow)';

  const displayedSeconds = phase === 'idle'
    ? activeInput === 'focus' ? focusInput : breakInput
    : secondsLeft;

  return (
    <main className="wireframe-container" aria-label="같이집중 레트로 타이머">
      <section className="retro-box status-box" style={{ borderColor: boxBorderColor }}>
        <span className="status-text">{statusText}</span>
      </section>

      <section className="retro-box timer-box" style={{ borderColor: boxBorderColor }}>
        <div
          className="timer-display"
          style={{ color: phase === 'break' ? '#00FFCC' : 'var(--accent-pink)' }}
          aria-live="polite"
        >
          {countdownStep || formatTime(displayedSeconds)}
        </div>

        {(phase === 'focus' || phase === 'break') && (
          <div style={{ width: '100%', height: '15px', border: `2px dashed ${boxBorderColor}`, position: 'relative', marginTop: '30px', background: 'transparent' }}>
            <div style={{ width: `${Math.min(100, exactProgress * 100)}%`, height: '100%', background: boxBorderColor, opacity: 0.3 }}></div>
            <div style={{ position: 'absolute', top: '-11px', left: `calc(${Math.min(100, exactProgress * 100)}% - 12px)`, fontSize: '24px', textShadow: '2px 2px 0px var(--bg)' }}>
              ❤️
            </div>
          </div>
        )}

        {phase === 'idle' && (
          <>
            <div className="toggle-container" aria-label="시간 종류 선택">
              <button
                className="btn-toggle"
                style={{
                  borderColor: activeInput === 'focus' ? 'var(--accent-pink)' : 'var(--border)',
                  color: activeInput === 'focus' ? 'var(--accent-pink)' : 'inherit',
                }}
                onClick={() => setActiveInput('focus')}
                type="button"
              >
                집중 시간
              </button>
              <button
                className="btn-toggle"
                style={{
                  borderColor: activeInput === 'break' ? 'var(--accent-pink)' : 'var(--border)',
                  color: activeInput === 'break' ? 'var(--accent-pink)' : 'inherit',
                }}
                onClick={() => setActiveInput('break')}
                type="button"
              >
                쉬는 시간
              </button>
            </div>

            <div className="quick-add-buttons" aria-label="빠른 시간 추가">
              <button className="btn-quick" onClick={() => addTime(1)} type="button">+1초</button>
              <button className="btn-quick" onClick={() => addTime(10)} type="button">+10초</button>
              <button className="btn-quick" onClick={() => addTime(30)} type="button">+30초</button>
              <button className="btn-quick" onClick={() => addTime(60)} type="button">+1분</button>
              <button className="btn-quick" onClick={() => addTime(600)} type="button">+10분</button>
              <button className="btn-quick" onClick={() => addTime(1800)} type="button">+30분</button>
              <button className="btn-quick" onClick={() => addTime(3600)} type="button">+1시간</button>
              <button
                className="btn-quick"
                onClick={clearTime}
                style={{ borderColor: 'var(--accent-pink)' }}
                type="button"
              >
                초기화
              </button>
            </div>

            <div className="settings-row">
              <span style={{ fontSize: '14px', marginBottom: '10px' }}>반복 세트 수</span>
              <div className="setting-controls">
                <button
                  className="btn-secondary"
                  style={{ padding: '10px 20px', fontSize: '20px' }}
                  onClick={() => setSetsInput(Math.max(1, setsInput - 1))}
                  type="button"
                  aria-label="반복 세트 줄이기"
                >
                  -
                </button>
                <span style={{ fontSize: '32px', fontFamily: "'Press Start 2P', cursive", color: 'var(--text)' }}>
                  {setsInput}
                </span>
                <button
                  className="btn-secondary"
                  style={{ padding: '10px 20px', fontSize: '20px' }}
                  onClick={() => setSetsInput(setsInput + 1)}
                  type="button"
                  aria-label="반복 세트 늘리기"
                >
                  +
                </button>
              </div>

              <div style={{display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '15px', marginTop: '30px', width: '100%'}}>
                <button 
                  className="btn-secondary" 
                  style={{
                    padding: '10px 15px', 
                    fontSize: '24px', 
                    borderColor: soundMode !== 'off' ? 'var(--accent-pink)' : 'var(--border)', 
                    color: soundMode !== 'off' ? 'var(--accent-pink)' : 'var(--text)',
                    borderRadius: '50%'
                  }} 
                  onClick={() => {
                    if (soundMode === 'off') setSoundMode('5s');
                    else setSoundMode('off');
                  }}
                  type="button"
                  title={soundMode === 'off' ? "소리 켜기" : "소리 끄기"}
                >
                  {soundMode === 'off' ? '🔇' : '🔊'}
                </button>

                {soundMode !== 'off' && (
                  <button 
                    className="btn-secondary" 
                    style={{
                      padding: '8px 15px', 
                      fontSize: '14px', 
                      borderColor: 'var(--accent-pink)', 
                      color: 'var(--accent-pink)'
                    }} 
                    onClick={() => {
                      if (soundMode === '5s') setSoundMode('all');
                      else setSoundMode('5s');
                    }}
                    type="button"
                  >
                    {soundMode === '5s' ? '마지막 5초만' : '매 초마다'}
                  </button>
                )}
              </div>
            </div>
          </>
        )}
      </section>

      <section className="action-container">
        {phase === 'idle' ? (
          <button
            className="retro-box btn-primary"
            onClick={startTimer}
            style={{ backgroundColor: 'var(--accent-pink)', borderColor: 'var(--accent-pink)' }}
            type="button"
          >
            START!
          </button>
        ) : (
          <button
            className="btn-secondary"
            onClick={stopTimer}
            style={{ width: '100%', padding: '15px', marginTop: '10px' }}
            type="button"
          >
            중단하고 처음으로
          </button>
        )}
      </section>
    </main>
  );
}
