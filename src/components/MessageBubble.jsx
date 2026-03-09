import { useEffect, useRef, useState } from 'react'
import { marked } from 'marked'
import { supabase } from '../lib/supabase'

marked.setOptions({ breaks: true, gfm: true })

// During streaming, incomplete markdown tokens cause ugly broken output.
// This sanitizes partial tokens so the parser always gets clean input.
function sanitizeStreaming(text) {
  let t = text

  // Close unclosed code fences (odd number of ```)
  const fenceCount = (t.match(/```/g) || []).length
  if (fenceCount % 2 !== 0) t += '\n```'

  // Close unclosed inline backticks (outside fenced blocks)
  const stripped = t.replace(/```[\s\S]*?```/g, '')
  const backtickCount = (stripped.match(/`/g) || []).length
  if (backtickCount % 2 !== 0) t += '`'

  // Close dangling **bold** — if there's an unclosed ** at the end
  t = t.replace(/(\*\*[^*\n]+)$/, '$1**')

  // Close dangling *italic* — if there's an unclosed * at the end
  t = t.replace(/(?<!\*)\*(?!\*)([^*\n]+)$/, '*$1*')

  // Remove incomplete list/header line at end (e.g. trailing "- " or "## ")
  t = t.replace(/\n[-*#>]+\s*$/, '')

  return t
}

function renderMarkdown(text, isStreaming = false) {
  try {
    const clean = isStreaming ? sanitizeStreaming(text) : text
    return marked.parse(clean)
  } catch { return text }
}

function addCopyButtons(el) {
  el.querySelectorAll('pre').forEach(pre => {
    if (pre.querySelector('.copy-btn')) return
    const btn = document.createElement('button')
    btn.textContent = 'Copy'
    btn.className = 'copy-btn'
    btn.style.cssText = 'position:absolute;top:8px;right:8px;padding:3px 10px;background:rgba(255,255,255,0.85);border:1px solid rgba(0,0,0,0.08);border-radius:6px;color:#4a5568;font-size:0.72rem;cursor:pointer;backdrop-filter:blur(4px);font-family:DM Sans,sans-serif;z-index:2;'
    btn.onclick = () => {
      navigator.clipboard.writeText(pre.querySelector('code')?.innerText || pre.innerText)
      btn.textContent = '✓ Copied'
      setTimeout(() => btn.textContent = 'Copy', 2000)
    }
    pre.style.position = 'relative'
    pre.appendChild(btn)
  })
  if (window.hljs) el.querySelectorAll('pre code').forEach(el => window.hljs.highlightElement(el))
}

// ── Parse code blocks from markdown ─────────────────────────────────────────
function parseCodeFiles(content) {
  const files = []
  const blockRegex = /```(\w+)(?:\s+([^\n]+))?\n([\s\S]*?)```/g
  let match
  while ((match = blockRegex.exec(content)) !== null) {
    const lang = match[1]
    const hint = match[2]?.trim()
    const code = match[3]
    let filename = null
    if (hint && /[./]/.test(hint) && !hint.includes(' ')) filename = hint
    else {
      const firstLine = code.split('\n')[0].trim()
      const m = firstLine.match(/^(?:\/\/|#|<!--|--|;)\s*([\w][\w.\-/]*\.\w+)\s*$/)
      if (m) filename = m[1]
    }
    files.push({ path: filename, content: code.trimEnd(), lang })
  }
  return files
}

function shouldShowZip(files) {
  const named = files.filter(f => f.path !== null)
  if (named.length < 2) return false
  const paths = new Set(named.map(f => f.path))
  if (paths.size < 2) return false
  const exts = new Set(named.map(f => f.path.split('.').pop()))
  if (exts.size === 1 && named.length === 2) {
    if (named.every(f => f.content.split('\n').length < 20)) return false
  }
  return true
}

// ── ZIP Download button ───────────────────────────────────────────────────
function ZipButton({ files, projectName }) {
  const [state, setState] = useState('idle')

  async function downloadZip() {
    setState('loading')
    try {
      const session = await supabase.auth.getSession()
      const token = session.data.session?.access_token
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-zip`
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ files, projectName }),
      })
      if (!res.ok) throw new Error(await res.text())
      const blob = await res.blob()
      const blobUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = blobUrl
      a.download = `${projectName}.zip`
      a.click()
      setTimeout(() => URL.revokeObjectURL(blobUrl), 5000)
      setState('done')
      setTimeout(() => setState('idle'), 3000)
    } catch (err) {
      console.error('ZIP error:', err)
      setState('error')
      setTimeout(() => setState('idle'), 3000)
    }
  }

  const label = { idle: 'Download ZIP', loading: 'Building ZIP…', done: '✓ Downloaded', error: 'Failed — retry' }
  const bg = { idle: 'rgba(0,122,255,0.08)', loading: 'rgba(0,122,255,0.05)', done: 'rgba(52,199,89,0.1)', error: 'rgba(255,59,48,0.08)' }
  const color = { idle: '#007AFF', loading: '#007AFF', done: '#1a7a35', error: '#cc2200' }
  const border = { idle: 'rgba(0,122,255,0.2)', loading: 'rgba(0,122,255,0.15)', done: 'rgba(52,199,89,0.25)', error: 'rgba(255,59,48,0.2)' }

  return (
    <button
      onClick={downloadZip}
      disabled={state === 'loading'}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 8,
        padding: '9px 18px', marginTop: 14,
        background: bg[state], border: `1px solid ${border[state]}`,
        borderRadius: 100, color: color[state], cursor: state === 'loading' ? 'not-allowed' : 'pointer',
        fontSize: '0.82rem', fontWeight: 500, fontFamily: 'DM Sans,sans-serif', transition: 'all 0.2s',
      }}
      onMouseEnter={e => { if (state === 'idle') { e.currentTarget.style.background = 'rgba(0,122,255,0.14)'; e.currentTarget.style.transform = 'translateY(-1px)' }}}
      onMouseLeave={e => { e.currentTarget.style.background = bg[state]; e.currentTarget.style.transform = 'translateY(0)' }}
    >
      {state === 'loading' ? (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83">
            <animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="0.8s" repeatCount="indefinite"/>
          </path>
        </svg>
      ) : (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
          <polyline points="7 10 12 15 17 10"/>
          <line x1="12" y1="15" x2="12" y2="3"/>
        </svg>
      )}
      {label[state]}
      <span style={{ fontSize: '0.72rem', opacity: 0.6, marginLeft: 2 }}>
        {state === 'idle' ? `${files.length} file${files.length !== 1 ? 's' : ''}` : ''}
      </span>
    </button>
  )
}

// ── Image download ─────────────────────────────────────────────────────────
async function downloadImage(imgUrl) {
  try {
    const res = await fetch(imgUrl)
    const blob = await res.blob()
    const blobUrl = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = blobUrl
    a.download = `orion-${Date.now()}.jpg`
    a.click()
    setTimeout(() => URL.revokeObjectURL(blobUrl), 5000)
  } catch {
    const a = document.createElement('a')
    a.href = imgUrl
    a.download = `orion-${Date.now()}.jpg`
    a.click()
  }
}

function ImageMessage({ imgUrl, prompt }) {
  return (
    <div>
      <img src={imgUrl} alt="Generated"
        style={{ maxWidth: 480, width: '100%', borderRadius: 16, marginBottom: 10, display: 'block', boxShadow: '0 8px 32px rgba(0,0,0,0.1)' }}
      />
      <button
        onClick={() => downloadImage(imgUrl)}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 7,
          padding: '8px 18px',
          background: 'rgba(0,122,255,0.08)', border: '1px solid rgba(0,122,255,0.2)',
          borderRadius: 100, color: '#007AFF', cursor: 'pointer',
          fontSize: '0.82rem', fontWeight: 500, fontFamily: 'DM Sans,sans-serif', transition: 'all 0.2s',
        }}
        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,122,255,0.15)'; e.currentTarget.style.transform = 'translateY(-1px)' }}
        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(0,122,255,0.08)'; e.currentTarget.style.transform = 'translateY(0)' }}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3v13M7 11l5 5 5-5"/><path d="M3 19h18"/>
        </svg>
        Save image
      </button>
      {prompt && <div style={{ marginTop: 8, color: '#8a95a8', fontSize: '0.78rem' }}>Prompt: {prompt}</div>}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────
export default function MessageBubble({ role, content, streaming }) {
  const bubbleRef = useRef(null)
  const isAI = role === 'assistant'

  const imageMatch = typeof content === 'string' && content.match(/^__IMAGE__(.+)__PROMPT__(.*)$/)
  const storedImgMatch = !imageMatch && typeof content === 'string' && content.match(/!\[image\]\(([^)]+)\)/)

  const codeFiles = (!streaming && isAI && !imageMatch && !storedImgMatch && typeof content === 'string')
    ? parseCodeFiles(content) : []
  const showZip = shouldShowZip(codeFiles)

  const projectName = (() => {
    const named = codeFiles.filter(f => f.path !== null)
    if (!named.length) return 'orion-project'
    const parts = named[0].path.split('/')
    if (parts.length > 1) return parts[0]
    return 'orion-project'
  })()

  useEffect(() => {
    if (!bubbleRef.current || !isAI || streaming || imageMatch || storedImgMatch) return
    addCopyButtons(bubbleRef.current)
  }, [content, streaming, isAI, imageMatch, storedImgMatch])

  const wrapStyle = {
    display: 'flex', gap: 10,
    animation: 'fadeUp 0.2s ease both',
    flexDirection: isAI ? 'row' : 'row-reverse',
    alignItems: 'flex-start',
  }
  const avatarStyle = {
    width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '0.7rem', fontWeight: 600,
    background: isAI ? 'linear-gradient(135deg,rgba(0,122,255,0.15),rgba(88,86,214,0.15))' : 'rgba(0,0,0,0.06)',
    border: isAI ? '1px solid rgba(0,122,255,0.2)' : '1px solid rgba(0,0,0,0.08)',
    color: isAI ? '#007AFF' : '#4a5568',
    marginTop: 2,
  }
  const bubbleStyle = {
    padding: '11px 15px', borderRadius: isAI ? '4px 16px 16px 16px' : '16px 4px 16px 16px',
    fontSize: '0.88rem', maxWidth: 'calc(100% - 50px)', wordBreak: 'break-word', lineHeight: 1.6,
    background: isAI ? 'rgba(255,255,255,0.72)' : 'rgba(0,122,255,0.09)',
    border: isAI ? '1px solid rgba(255,255,255,0.9)' : '1px solid rgba(0,122,255,0.18)',
    backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
    boxShadow: isAI ? '0 2px 12px rgba(100,120,180,0.08)' : '0 2px 12px rgba(0,122,255,0.06)',
    whiteSpace: isAI ? undefined : 'pre-wrap',
    color: '#1a1d23',
  }

  if (imageMatch) return (
    <div style={wrapStyle}>
      <div style={avatarStyle}>O</div>
      <div style={bubbleStyle}><ImageMessage imgUrl={imageMatch[1]} prompt={imageMatch[2]} /></div>
    </div>
  )

  if (storedImgMatch) {
    const imgUrl = storedImgMatch[1]
    const rest = content.replace(/!\[image\]\([^)]+\)/, '').trim()
    return (
      <div style={wrapStyle}>
        <div style={avatarStyle}>O</div>
        <div style={bubbleStyle}><ImageMessage imgUrl={imgUrl} prompt={rest || undefined} /></div>
      </div>
    )
  }

  if (isAI && streaming) return (
    <div style={wrapStyle}>
      <div style={avatarStyle}>O</div>
      <div style={bubbleStyle} className="bubble">
        <div dangerouslySetInnerHTML={{ __html: renderMarkdown(content, true) }} />
        <span style={{ display: 'inline-block', width: 2, height: '1em', background: '#007AFF', marginLeft: 3, animation: 'blink 0.7s step-end infinite', verticalAlign: 'text-bottom', borderRadius: 2 }} />
      </div>
    </div>
  )

  if (isAI) return (
    <div style={wrapStyle}>
      <div style={avatarStyle}>O</div>
      <div style={{ ...bubbleStyle, padding: showZip ? '11px 15px 15px' : '11px 15px' }} className="bubble" ref={bubbleRef}>
        <div dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }} />
        {showZip && <ZipButton files={codeFiles.filter(f => f.path !== null)} projectName={projectName} />}
      </div>
    </div>
  )

  return (
    <div style={wrapStyle}>
      <div style={avatarStyle}>Me</div>
      <div style={bubbleStyle}>{content}</div>
    </div>
  )
}