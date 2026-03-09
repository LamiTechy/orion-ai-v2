import { useState, useEffect, useRef, useCallback } from 'react'
import { streamEdgeFunction } from '../lib/supabase'

// ── Waveform animation bars ────────────────────────────────────────────────
function Waveform({ active, color = '#fff' }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 3, height: 32 }}>
      {[0,1,2,3,4,5,6].map(i => (
        <div key={i} style={{
          width: 3, borderRadius: 3,
          background: color,
          opacity: active ? 1 : 0.25,
          height: active ? undefined : 6,
          animation: active ? `wave ${0.8 + i * 0.1}s ease-in-out infinite alternate` : 'none',
          animationDelay: `${i * 0.08}s`,
        }} />
      ))}
      <style>{`
        @keyframes wave {
          0%  { height: 4px; }
          100% { height: 28px; }
        }
        @keyframes pulse-ring {
          0%   { transform: scale(1);   opacity: 0.4; }
          100% { transform: scale(1.6); opacity: 0; }
        }
        @keyframes call-fade-in {
          from { opacity: 0; transform: scale(0.96); }
          to   { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  )
}

// ── Orb that pulses while AI speaks ───────────────────────────────────────
function OrionOrb({ speaking, listening }) {
  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', width: 120, height: 120 }}>
      {(speaking || listening) && (
        <div style={{
          position: 'absolute', inset: -16,
          borderRadius: '50%',
          border: `2px solid ${speaking ? 'rgba(255,255,255,0.5)' : 'rgba(99,210,255,0.5)'}`,
          animation: 'pulse-ring 1.4s ease-out infinite',
        }} />
      )}
      <div style={{
        width: 120, height: 120, borderRadius: '50%',
        background: speaking
          ? 'linear-gradient(135deg, #007AFF, #5856d6)'
          : listening
          ? 'linear-gradient(135deg, #34c759, #00b4d8)'
          : 'linear-gradient(135deg, rgba(255,255,255,0.15), rgba(255,255,255,0.05))',
        border: '2px solid rgba(255,255,255,0.3)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: speaking
          ? '0 0 60px rgba(0,122,255,0.6)'
          : listening
          ? '0 0 60px rgba(52,199,89,0.5)'
          : '0 0 30px rgba(255,255,255,0.1)',
        transition: 'all 0.4s ease',
        fontSize: '2.2rem',
        fontFamily: "'DM Serif Display', serif",
        color: '#fff',
      }}>
        O
      </div>
    </div>
  )
}

// ── Strip tool-call artifacts and markdown before speaking ─────────────────
function cleanForSpeech(text) {
  return text
    .replace(/\w+\.\w+\("[^"]*"\)/g, '')
    .replace(/\w+\.\w+\('[^']*'\)/g, '')
    .replace(/<\/?(?:tool_call|function)[^>]*>/g, '')
    .replace(/```[\s\S]*?```/g, 'Here is the code.')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/#{1,6}\s/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/https?:\/\/\S+/g, 'a link')
    .replace(/\[\w+\]/g, '')
    .replace(/\n{2,}/g, '. ')
    .replace(/\n/g, ' ')
    .trim()
}

// ── Main CallMode component ────────────────────────────────────────────────
export default function CallMode({ user, onClose }) {
  const [phase, setPhase] = useState('idle')
  const [transcript, setTranscript] = useState('')
  const [aiText, setAiText] = useState('')
  const [callDuration, setCallDuration] = useState(0)
  const [error, setError] = useState(null)

  const recognitionRef  = useRef(null)
  const timerRef        = useRef(null)
  const conversationId  = useRef(null)
  const isMounted       = useRef(true)

  useEffect(() => {
    timerRef.current = setInterval(() => setCallDuration(d => d + 1), 1000)
    return () => clearInterval(timerRef.current)
  }, [])

  useEffect(() => {
    isMounted.current = true
    return () => {
      isMounted.current = false
      window.speechSynthesis.cancel()
      recognitionRef.current?.stop()
    }
  }, [])

  function fmt(s) {
    const m = Math.floor(s / 60).toString().padStart(2, '0')
    const sec = (s % 60).toString().padStart(2, '0')
    return `${m}:${sec}`
  }

  // ── Speak via browser speechSynthesis ────────────────────────────────────
  const speak = useCallback((text) => {
    if (!isMounted.current) return
    setPhase('speaking')
    setAiText(text)

    window.speechSynthesis.cancel()

    const cleaned = cleanForSpeech(text)
    if (!cleaned) {
      setTimeout(() => { if (isMounted.current) startListening() }, 400)
      return
    }

    const utterance = new SpeechSynthesisUtterance(cleaned)

    const voices = window.speechSynthesis.getVoices()
    const preferred = voices.find(v => /google|natural|enhanced|premium/i.test(v.name) && v.lang.startsWith('en'))
      || voices.find(v => v.lang.startsWith('en'))
    if (preferred) utterance.voice = preferred

    utterance.rate   = 1.0
    utterance.pitch  = 1.0
    utterance.volume = 1.0

    utterance.onend = () => {
      if (!isMounted.current) return
      setTimeout(() => { if (isMounted.current) startListening() }, 400)
    }

    utterance.onerror = (e) => {
      if (!isMounted.current) return
      if (e.error !== 'interrupted') setError('Speech error: ' + e.error)
      setPhase('idle')
    }

    window.speechSynthesis.speak(utterance)
  }, []) // startListening added via ref below to avoid circular dep

  // ── Get AI response ───────────────────────────────────────────────────────
  const askAI = useCallback(async (userText) => {
    if (!isMounted.current) return
    setPhase('thinking')
    setTranscript(userText)
    setAiText('')

    try {
      const res = await streamEdgeFunction('chat-stream', {
        message: userText,
        conversationId: conversationId.current,
        userId: user.id,
        voiceMode: true,
      })

      if (!res.ok) throw new Error('Stream failed')

      const reader  = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = '', fullText = ''

      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop()
        for (const line of lines) {
          if (!line.startsWith('data:')) continue
          try {
            const data = JSON.parse(line.slice(5).trim())
            if (data.type === 'start' && data.conversationId) {
              conversationId.current = data.conversationId
            } else if (data.type === 'delta') {
              fullText += data.text
            } else if (data.type === 'done') {
              if (isMounted.current) speak(fullText)
            }
          } catch (_) {}
        }
      }
    } catch (e) {
      console.error('AI error:', e)
      if (isMounted.current) {
        setError(e.message)
        setPhase('idle')
      }
    }
  }, [speak, user.id])

  // ── Start listening ───────────────────────────────────────────────────────
  const startListening = useCallback(() => {
    if (!isMounted.current) return
    setError(null)
    setPhase('listening')
    setTranscript('')

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) {
      setError('Speech recognition not supported. Use Chrome or Edge.')
      setPhase('idle')
      return
    }

    const rec = new SR()
    rec.continuous      = false
    rec.interimResults  = true
    rec.lang            = 'en-US'
    recognitionRef.current = rec

    let finalTranscript = ''

    rec.onresult = (e) => {
      let interim = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) finalTranscript += e.results[i][0].transcript
        else interim += e.results[i][0].transcript
      }
      setTranscript(finalTranscript || interim)
    }

    rec.onend = () => {
      if (!isMounted.current) return
      if (finalTranscript.trim()) askAI(finalTranscript.trim())
      else { setPhase('idle'); setTranscript('') }
    }

    rec.onerror = (e) => {
      if (!isMounted.current) return
      if (e.error !== 'no-speech') setError('Mic error: ' + e.error)
      setPhase('idle')
    }

    rec.start()
  }, [askAI])

  function interrupt() {
    window.speechSynthesis.cancel()
    recognitionRef.current?.stop()
    setPhase('idle')
    setAiText('')
  }

  function endCall() {
    window.speechSynthesis.cancel()
    recognitionRef.current?.stop()
    clearInterval(timerRef.current)
    onClose()
  }

  const phaseLabel = {
    idle:     'Tap the mic to speak',
    listening: 'Listening…',
    thinking:  'Thinking…',
    speaking:  'Orion is speaking',
  }

  const isSpeaking  = phase === 'speaking'
  const isListening = phase === 'listening'

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'linear-gradient(160deg, #0a0f1e 0%, #0d1b3e 40%, #0a0f1e 100%)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'space-between',
      padding: '60px 32px 48px',
      animation: 'call-fade-in 0.3s ease both',
    }}>

      {/* Top */}
      <div style={{ textAlign: 'center' }}>
        <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.75rem', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 6 }}>
          Voice Call
        </div>
        <div style={{ color: '#fff', fontSize: '1.1rem', fontWeight: 600, fontFamily: "'DM Serif Display', serif" }}>
          Orion AI
        </div>
        <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.82rem', marginTop: 4 }}>
          {fmt(callDuration)}
        </div>
      </div>

      {/* Middle */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 32, flex: 1, justifyContent: 'center' }}>
        <OrionOrb speaking={isSpeaking} listening={isListening} />

        <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.85rem', minHeight: 20 }}>
          {phaseLabel[phase]}
        </div>

        <Waveform active={isSpeaking || isListening} color={isListening ? '#63d2ff' : '#fff'} />

        <div style={{ maxWidth: 320, width: '100%', minHeight: 56, textAlign: 'center', padding: '0 8px' }}>
          {phase === 'listening' && transcript && (
            <div style={{ color: '#63d2ff', fontSize: '0.92rem', lineHeight: 1.5, fontStyle: 'italic' }}>
              "{transcript}"
            </div>
          )}
          {phase === 'thinking' && (
            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.85rem' }}>
              Processing…
            </div>
          )}
          {phase === 'speaking' && aiText && (
            <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: '0.88rem', lineHeight: 1.6, maxHeight: 120, overflow: 'hidden' }}>
              {aiText.length > 180 ? aiText.slice(0, 180) + '…' : aiText}
            </div>
          )}
          {error && (
            <div style={{ color: '#ff6b6b', fontSize: '0.82rem', marginTop: 8 }}>{error}</div>
          )}
        </div>
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
        <button
          onClick={isSpeaking ? interrupt : undefined}
          style={{
            width: 52, height: 52, borderRadius: '50%', border: 'none',
            background: isSpeaking ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.06)',
            color: isSpeaking ? '#fff' : 'rgba(255,255,255,0.25)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: isSpeaking ? 'pointer' : 'not-allowed', transition: 'all 0.2s',
          }}
          title="Interrupt"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="6" width="4" height="12" rx="1"/>
            <rect x="14" y="6" width="4" height="12" rx="1"/>
          </svg>
        </button>

        <button
          onClick={phase === 'idle' ? startListening : phase === 'listening' ? () => recognitionRef.current?.stop() : undefined}
          style={{
            width: 76, height: 76, borderRadius: '50%', border: 'none',
            background: isListening
              ? 'linear-gradient(135deg, #34c759, #00b4d8)'
              : 'linear-gradient(135deg, #007AFF, #5856d6)',
            color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: (phase === 'thinking' || phase === 'speaking') ? 'not-allowed' : 'pointer',
            boxShadow: isListening ? '0 0 0 8px rgba(52,199,89,0.2)' : '0 0 0 8px rgba(0,122,255,0.2)',
            transition: 'all 0.3s',
            opacity: (phase === 'thinking' || phase === 'speaking') ? 0.5 : 1,
          }}
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="9" y="2" width="6" height="13" rx="3"/>
            <path d="M5 10a7 7 0 0014 0"/>
            <line x1="12" y1="19" x2="12" y2="23"/>
            <line x1="8" y1="23" x2="16" y2="23"/>
          </svg>
        </button>

        <button
          onClick={endCall}
          style={{
            width: 52, height: 52, borderRadius: '50%', border: 'none',
            background: '#ff3b30', color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', boxShadow: '0 4px 20px rgba(255,59,48,0.35)',
            transition: 'all 0.2s',
          }}
          title="End call"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
            <path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z"/>
          </svg>
        </button>
      </div>
    </div>
  )
}