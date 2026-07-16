import React, { useEffect, useRef, useState } from 'react';

function AdFitBanner() {
  const adRef = useRef(null);

  useEffect(() => {
    const isScriptLoaded = document.getElementById('adfit-script');
    
    if (!isScriptLoaded) {
      const script = document.createElement('script');
      script.id = 'adfit-script';
      script.type = 'text/javascript';
      script.src = '//t1.kakaocdn.net/kas/static/ba.min.js';
      script.async = true;
      document.body.appendChild(script);
    }
  }, []);

  return (
    <div ref={adRef} className="adfit-wrapper">
      <ins
        className="kakao_ad_area"
        style={{ display: 'none' }}
        data-ad-unit="DAN-xo4vUv6nINxeqGFk"
        data-ad-width="320"
        data-ad-height="100"
      ></ins>
    </div>
  );
}

let sharedAudioContext;
const toneCache = new Map();

function makeWavDataUri(frequency = 880, duration = 120, volume = 0.75) {
  const cacheKey = `${frequency}-${duration}-${volume}`;
  if (toneCache.has(cacheKey)) return toneCache.get(cacheKey);

  const sampleRate = 44100;
  const sampleCount = Math.floor(sampleRate * (duration / 1000));
  const bytesPerSample = 2;
  const dataSize = sampleCount * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const writeString = (offset, value) => {
    for (let i = 0; i < value.length; i += 1) {
      view.setUint8(offset + i, value.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * bytesPerSample, true);
  view.setUint16(32, bytesPerSample, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  for (let i = 0; i < sampleCount; i += 1) {
    const t = i / sampleRate;
    const fade = Math.min(1, i / 300, (sampleCount - i) / 300);
    const sample = Math.sin(2 * Math.PI * frequency * t) * volume * fade;
    view.setInt16(44 + i * bytesPerSample, sample * 32767, true);
  }

  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }

  const uri = `data:audio/wav;base64,${btoa(binary)}`;
  toneCache.set(cacheKey, uri);
  return uri;
}

function playHtmlTone(frequency = 880, duration = 120, delayMs = 0) {
  window.setTimeout(() => {
    const audio = new Audio(makeWavDataUri(frequency, duration));
    audio.preload = 'auto';
    audio.volume = 1;
    audio.play().catch((error) => {
      console.info('HTMLAudio playback failed.', error);
    });
  }, delayMs);
}

async function getAudioContext() {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return null;

  if (!sharedAudioContext) {
    sharedAudioContext = new AudioContext();
  }

  if (sharedAudioContext.state === 'suspended') {
    await sharedAudioContext.resume();
  }

  return sharedAudioContext;
}

function makeToneBuffer(audioCtx, frequency, duration, volume) {
  const sampleRate = audioCtx.sampleRate;
  const frameCount = Math.max(1, Math.floor(sampleRate * (duration / 1000)));
  const buffer = audioCtx.createBuffer(1, frameCount, sampleRate);
  const data = buffer.getChannelData(0);
  const fadeFrames = Math.max(1, Math.floor(sampleRate * 0.01));

  for (let i = 0; i < frameCount; i += 1) {
    const t = i / sampleRate;
    const wave = Math.sin(2 * Math.PI * frequency * t);
    const fadeIn = Math.min(1, i / fadeFrames);
    const fadeOut = Math.min(1, (frameCount - i) / fadeFrames);
    data[i] = wave * volume * Math.min(fadeIn, fadeOut);
  }

  return buffer;
}

async function playTone(frequency = 880, duration = 90, startOffset = 0, volume = 0.16) {
  playHtmlTone(frequency, duration, startOffset * 1000);

  try {
    const audioCtx = await getAudioContext();
    if (!audioCtx) return false;

    const source = audioCtx.createBufferSource();
    source.buffer = makeToneBuffer(audioCtx, frequency, duration, volume);
    source.connect(audioCtx.destination);
    source.start(audioCtx.currentTime + startOffset);
    return true;
  } catch (error) {
    console.info('Audio playback failed.', error);
    return false;
  }
}

async function unlockAudio() {
  playHtmlTone(740, 120, 0);
  const played = await playTone(740, 120, 0, 0.22);
  return played && sharedAudioContext?.state === 'running';
}

function playTickSound() {
  playTone(920, 110, 0, 0.24);
}

function playFinalRing() {
  playTone(1040, 150, 0, 0.24);
  playTone(1320, 260, 0.16, 0.24);
}

function playSoundTest() {
  playTone(740, 120, 0, 0.24);
  playTone(920, 120, 0.16, 0.24);
  playTone(1180, 180, 0.32, 0.24);
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
  const [workoutInput, setWorkoutInput] = useState(0);
  const [breakInput, setBreakInput] = useState(0);
  const [setsInput, setSetsInput] = useState(5);
  const [activeInput, setActiveInput] = useState('workout');
  const [soundMode, setSoundMode] = useState('5s');
  const [audioReady, setAudioReady] = useState(false);
  const [wakeLockActive, setWakeLockActive] = useState(false);
  const [lang, setLang] = useState('ko');

  const [phase, setPhase] = useState('idle');
  const [endTime, setEndTime] = useState(null);
  const [currentSet, setCurrentSet] = useState(1);
  const [countdownStep, setCountdownStep] = useState(null);
  const [now, setNow] = useState(Date.now());

  const lastTickedSecond = useRef(null);
  const wakeLockRef = useRef(null);

  const isRunning = phase === 'workout' || phase === 'break';

  const t = {
    ko: {
      planGame: 'PLAN GAME',
      workoutPhase: '운동 중!',
      breakPhase: '쉬는 시간!',
      clearPhase: '완료!!',
      workoutTime: '운동 시간',
      breakTime: '쉬는 시간',
      clear: '초기화',
      setsTitle: '반복 세트 수',
      soundReady: '소리 준비 완료',
      soundTestPrompt: '스피커 버튼을 눌러 소리를 테스트해 주세요',
      onlyLast5s: '마지막 5초만',
      everySec: '매초마다',
      off: '끄기',
      start: 'START!',
      stopReset: '중단하고 처음으로',
      wakeLockOn: '화면 유지 ON',
      wakeLockWarn: '브라우저가 화면 유지를 제한할 수 있어요',
      sec: '초',
      min: '분',
      hr: '시간'
    },
    en: {
      planGame: 'PLAN GAME',
      workoutPhase: 'WORKOUT!',
      breakPhase: 'REST!',
      clearPhase: 'DONE!!',
      workoutTime: 'WORKOUT',
      breakTime: 'REST',
      clear: 'CLEAR',
      setsTitle: 'SETS',
      soundReady: 'SOUND READY',
      soundTestPrompt: 'TAP SPEAKER TO TEST SOUND',
      onlyLast5s: 'LAST 5s',
      everySec: 'EVERY SEC',
      off: 'OFF',
      start: 'START!',
      stopReset: 'STOP & RESET',
      wakeLockOn: 'SCREEN WAKE ON',
      wakeLockWarn: 'Browser may limit screen wake',
      sec: 's',
      min: 'm',
      hr: 'h'
    }
  };

  useEffect(() => {
    if (phase === 'idle' || phase === 'clear' || countdownStep) return undefined;

    const interval = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(interval);
  }, [phase, countdownStep]);

  useEffect(() => {
    let cancelled = false;

    async function releaseWakeLock() {
      if (wakeLockRef.current) {
        await wakeLockRef.current.release().catch(() => {});
        wakeLockRef.current = null;
      }
      if (!cancelled) setWakeLockActive(false);
    }

    async function requestWakeLock() {
      if (!('wakeLock' in navigator) || !isRunning || document.visibilityState !== 'visible') return;

      try {
        if (wakeLockRef.current) return;
        wakeLockRef.current = await navigator.wakeLock.request('screen');
        wakeLockRef.current.addEventListener('release', () => {
          wakeLockRef.current = null;
          if (!cancelled) setWakeLockActive(false);
        });
        if (!cancelled) setWakeLockActive(true);
      } catch (error) {
        console.info('Screen Wake Lock is unavailable.', error);
        if (!cancelled) setWakeLockActive(false);
      }
    }

    if (isRunning) {
      requestWakeLock();
    } else {
      releaseWakeLock();
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isRunning) {
        requestWakeLock();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (!isRunning) releaseWakeLock();
    };
  }, [isRunning]);

  let secondsLeft = phase === 'idle' ? workoutInput : 0;
  if (endTime && now < endTime) {
    secondsLeft = Math.max(0, Math.ceil((endTime - now) / 1000));
  }

  let exactProgress = 0;
  if (isRunning && endTime) {
    const totalMs = (phase === 'workout' ? workoutInput : breakInput) * 1000;
    if (totalMs > 0) {
      const msLeft = Math.max(0, endTime - now);
      exactProgress = 1 - (msLeft / totalMs);
    }
  }

  useEffect(() => {
    if (!isRunning || !endTime) return;

    if (now >= endTime) {
      if (soundMode !== 'off') playFinalRing();
      lastTickedSecond.current = null;

      if (phase === 'workout') {
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
          setEndTime(Date.now() + workoutInput * 1000);
        }
      } else if (phase === 'break') {
        setPhase('workout');
        setCurrentSet((set) => set + 1);
        setEndTime(Date.now() + workoutInput * 1000);
      }
    } else if (secondsLeft > 0 && lastTickedSecond.current !== secondsLeft) {
      lastTickedSecond.current = secondsLeft;

      if (soundMode === 'all' || (soundMode === '5s' && secondsLeft <= 5)) {
        playTickSound();
      }
    }
  }, [now, endTime, phase, currentSet, setsInput, workoutInput, breakInput, secondsLeft, soundMode, isRunning]);

  const enableSound = async (nextMode = soundMode === 'off' ? '5s' : soundMode) => {
    setSoundMode(nextMode);
    const unlocked = await unlockAudio();
    setAudioReady(unlocked);
    playSoundTest();
  };

  const startTimer = async () => {
    if (soundMode !== 'off') {
      const unlocked = await unlockAudio();
      setAudioReady(unlocked);
    }

    const workoutSeconds = workoutInput > 0 ? workoutInput : 30;
    const currentTime = Date.now();
    const startTime = currentTime + 1000;

    setWorkoutInput(workoutSeconds);
    setNow(currentTime);
    setCountdownStep('START!');
    setEndTime(startTime + workoutSeconds * 1000);
    setCurrentSet(1);
    setPhase('workout');
    lastTickedSecond.current = null;
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
  };

  const addTime = (seconds) => {
    if (activeInput === 'workout') setWorkoutInput((prev) => prev + seconds);
    if (activeInput === 'break') setBreakInput((prev) => prev + seconds);
  };

  const clearTime = () => {
    if (activeInput === 'workout') setWorkoutInput(0);
    if (activeInput === 'break') setBreakInput(0);
  };

  let statusText = t[lang].planGame;
  if (countdownStep) statusText = countdownStep;
  else if (phase === 'workout') statusText = `SET ${currentSet}/${setsInput} : ${t[lang].workoutPhase}`;
  else if (phase === 'break') statusText = `SET ${currentSet}/${setsInput} : ${t[lang].breakPhase}`;
  else if (phase === 'clear') statusText = t[lang].clearPhase;

  let boxBorderColor = 'var(--border)';
  if (phase === 'workout') boxBorderColor = 'var(--accent-pink)';
  if (phase === 'break') boxBorderColor = '#00FFCC';
  if (phase === 'clear') boxBorderColor = 'var(--accent-yellow)';

  const displayedSeconds = phase === 'idle'
    ? activeInput === 'workout' ? workoutInput : breakInput
    : secondsLeft;

  return (
    <main className="wireframe-container" aria-label="Workout Timer 레트로 운동 타이머">
      <div style={{ display: 'flex', justifyContent: 'flex-end', width: '100%', marginBottom: '-10px' }}>
        <button 
          className="btn-secondary" 
          style={{ fontSize: '12px', padding: '5px 10px', borderRadius: '4px' }}
          onClick={() => setLang(l => l === 'ko' ? 'en' : 'ko')}
        >
          {lang === 'ko' ? '🇺🇸 EN' : '🇰🇷 KO'}
        </button>
      </div>

      {/* 광고 배너 (상단 전광판 간판 역할) */}
      {phase !== 'idle' && (
        <div className="ad-container" style={{ margin: '0 auto', display: 'flex', justifyContent: 'center' }}>
          <AdFitBanner />
        </div>
      )}

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

        {isRunning && (
          <div className="progress-track" aria-label="타이머 진행률">
            <div
              className="progress-fill"
              style={{ width: `${Math.min(100, exactProgress * 100)}%`, background: boxBorderColor }}
            />
            <div
              className="progress-runner"
              style={{ left: `calc(${Math.min(100, exactProgress * 100)}% - 12px)` }}
            >
              🚀
            </div>
          </div>
        )}

        {phase === 'idle' && (
          <>
            <div className="toggle-container" aria-label="시간 종류 선택">
              <button
                className="btn-toggle"
                style={{
                  borderColor: activeInput === 'workout' ? 'var(--accent-pink)' : 'var(--border)',
                  color: activeInput === 'workout' ? 'var(--accent-pink)' : 'inherit',
                }}
                onClick={() => setActiveInput('workout')}
                type="button"
              >
                {t[lang].workoutTime}
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
                {t[lang].breakTime}
              </button>
            </div>

            <div className="quick-add-buttons" aria-label="빠른 시간 추가">
              <button className="btn-quick" onClick={() => addTime(1)} type="button">+1{t[lang].sec}</button>
              <button className="btn-quick" onClick={() => addTime(10)} type="button">+10{t[lang].sec}</button>
              <button className="btn-quick" onClick={() => addTime(30)} type="button">+30{t[lang].sec}</button>
              <button className="btn-quick" onClick={() => addTime(60)} type="button">+1{t[lang].min}</button>
              <button className="btn-quick" onClick={() => addTime(600)} type="button">+10{t[lang].min}</button>
              <button className="btn-quick" onClick={() => addTime(1800)} type="button">+30{t[lang].min}</button>
              <button className="btn-quick" onClick={() => addTime(3600)} type="button">+1{t[lang].hr}</button>
              <button
                className="btn-quick"
                onClick={clearTime}
                style={{ borderColor: 'var(--accent-pink)' }}
                type="button"
              >
                {t[lang].clear}
              </button>
            </div>

            <div className="settings-row">
              <span style={{ fontSize: '14px', marginBottom: '10px' }}>{t[lang].setsTitle}</span>
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

              <div className="sound-controls">
                <button
                  className="btn-secondary sound-toggle"
                  style={{
                    borderColor: soundMode !== 'off' ? 'var(--accent-pink)' : 'var(--border)',
                    color: soundMode !== 'off' ? 'var(--accent-pink)' : 'var(--text)',
                  }}
                  onClick={() => enableSound(soundMode === 'off' ? '5s' : soundMode)}
                  type="button"
                  title="소리 켜기/테스트"
                >
                  {soundMode === 'off' ? '🔇' : '🔊'}
                </button>

                {soundMode !== 'off' && (
                  <>
                    <button
                      className="btn-secondary"
                      style={{ borderColor: 'var(--accent-pink)', color: 'var(--accent-pink)' }}
                      onClick={() => enableSound(soundMode === '5s' ? 'all' : '5s')}
                      type="button"
                    >
                      {soundMode === '5s' ? t[lang].onlyLast5s : t[lang].everySec}
                    </button>
                    <button className="btn-secondary" onClick={() => setSoundMode('off')} type="button">
                      {t[lang].off}
                    </button>
                  </>
                )}
              </div>

              {soundMode !== 'off' && (
                <p className="tiny-note">
                  {audioReady ? t[lang].soundReady : t[lang].soundTestPrompt}
                </p>
              )}
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
            {t[lang].start}
          </button>
        ) : (
          <>
            <button
              className="btn-secondary"
              onClick={stopTimer}
              style={{ width: '100%', padding: '15px', marginTop: '10px' }}
              type="button"
            >
              {t[lang].stopReset}
            </button>
            <p className="tiny-note">{wakeLockActive ? t[lang].wakeLockOn : t[lang].wakeLockWarn}</p>
          </>
        )}
      </section>
    </main>
  );
}
