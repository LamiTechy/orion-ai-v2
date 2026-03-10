import { useEffect, useRef, useState } from 'react'
import { marked } from 'marked'
import { supabase } from '../lib/supabase'

marked.setOptions({ breaks: true, gfm: true })

function sanitizeStreaming(text) {
  let t = text
  const fenceCount = (t.match(/```/g) || []).length
  if (fenceCount % 2 !== 0) t += '\n```'
  const stripped = t.replace(/```[\s\S]*?```/g, '')
  const backtickCount = (stripped.match(/`/g) || []).length
  if (backtickCount % 2 !== 0) t += '`'
  t = t.replace(/(\*\*[^*\n]+)$/, '$1**')
  t = t.replace(/(?<!\*)\*(?!\*)([^*\n]+)$/, '*$1*')
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

function parseCodeFiles(content) {
  const files = []
  const blockRegex = /```(\w+)(?:\s+([^\n]+))?\n([\s\S]*?)```/g
  let match
  let unnamedCount = 0
  while ((match = blockRegex.exec(content)) !== null) {
    const lang = match[1]
    const hint = match[2]?.trim()
    const code = match[3]
    let filename = null

    if (hint && /[./]/.test(hint) && !hint.includes(' ')) {
      filename = hint
    } else {
      const firstLine = code.split('\n')[0].trim()
      const m = firstLine.match(/^(?:\/\/|#|<!--|--|;|\/\*)\s*([\w][\w.\-/]*\.\w+)\s*(?:-->|\*\/)?$/)
      if (m) filename = m[1]
    }

    if (!filename) {
      const extMap = {
        javascript: 'js', typescript: 'ts', jsx: 'jsx', tsx: 'tsx',
        python: 'py', html: 'html', css: 'css', scss: 'scss',
        json: 'json', bash: 'sh', shell: 'sh', sql: 'sql',
        rust: 'rs', go: 'go', java: 'java', cpp: 'cpp', c: 'c',
        yaml: 'yml', toml: 'toml', markdown: 'md', php: 'php',
        ruby: 'rb', swift: 'swift', kotlin: 'kt',
      }
      const ext = extMap[lang.toLowerCase()] || lang
      const lines = code.split('\n').slice(0, 20).join('\n')
      let inferredName = null

      if (ext === 'html') {
        const t = code.match(/<title[^>]*>([^<]{1,40})<\/title>/i)
        inferredName = t ? t[1].trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '.html' : 'index.html'
      } else if (ext === 'css' || ext === 'scss') {
        if (/(?:body|:root|html)\s*\{/.test(code)) inferredName = 'styles.' + ext
        else { const sel = code.match(/^\s*\.([a-z][a-z0-9-]+)[\s{,]/m); inferredName = sel ? sel[1] + '.' + ext : 'styles.' + ext }
      } else if (['js','ts','jsx','tsx'].includes(ext)) {
        const comp = lines.match(/export\s+default\s+(?:function|class)\s+([A-Z][a-zA-Z0-9]+)/)
        if (comp) inferredName = comp[1] + '.' + ext
        else {
          const named = lines.match(/export\s+(?:function|const|class)\s+([A-Z][a-zA-Z0-9]+)/)
          if (named) inferredName = named[1] + '.' + ext
          else if (/(?:app\.listen|createServer|ReactDOM\.render|createRoot)/.test(code)) inferredName = 'index.' + ext
          else { unnamedCount++; inferredName = unnamedCount === 1 ? 'index.' + ext : 'module' + unnamedCount + '.' + ext }
        }
      } else if (ext === 'py') {
        if (/__name__\s*==\s*['"]__main__['"]/.test(code)) inferredName = 'main.py'
        else { const cls = lines.match(/^class\s+([A-Z][a-zA-Z0-9]+)/m); inferredName = cls ? cls[1].toLowerCase() + '.py' : 'main.py' }
      } else if (ext === 'json') {
        if (/"name"\s*:/.test(lines) && /"version"\s*:/.test(lines)) inferredName = 'package.json'
        else if (/"compilerOptions"/.test(lines)) inferredName = 'tsconfig.json'
        else inferredName = 'config.json'
      } else if (ext === 'sh') {
        inferredName = /npm install|yarn add/.test(code) ? 'setup.sh' : /docker/.test(code) ? 'docker.sh' : 'run.sh'
      } else if (ext === 'sql') {
        inferredName = /CREATE TABLE/i.test(code) ? 'schema.sql' : /INSERT INTO/i.test(code) ? 'seed.sql' : 'query.sql'
      } else {
        unnamedCount++
        inferredName = unnamedCount === 1 ? 'index.' + ext : 'file' + unnamedCount + '.' + ext
      }
      filename = inferredName
    }

    if (code.trim().split('\n').length >= 3) {
      files.push({ path: filename, content: code.trimEnd(), lang })
    }
  }
  return files
}

function shouldShowZip(files) {
  if (files.length < 2) return false
  return files.reduce((sum, f) => sum + f.content.split('\n').length, 0) >= 15
}

function deriveProjectName(files) {
  const named = files.filter(f => f.path && f.path.includes('/'))
  if (named.length) return named[0].path.split('/')[0]
  const htmlFile = files.find(f => f.path?.endsWith('.html'))
  if (htmlFile) return htmlFile.path.replace('.html', '')
  return 'orion-project'
}

function getPreviewable(files) {
  const html = files.find(f => f.path?.endsWith('.html') || f.lang === 'html')
  if (html) return { type: 'html' }
  const jsx = files.find(f => ['jsx','tsx','js','ts'].includes(f.lang) &&
    /import\s+React|from\s+['"]react['"]|export\s+default\s+function|export\s+default\s+const/.test(f.content))
  if (jsx) return { type: 'react' }
  return null
}

function buildHTMLPreview(files) {
  const html = files.find(f => f.path?.endsWith('.html') || f.lang === 'html')
  if (!html) return null
  const css = files.filter(f => f.lang === 'css' || f.lang === 'scss').map(f => f.content).join('\n')
  const js = files.filter(f => ['js','ts'].includes(f.lang)).map(f => f.content).join('\n')
  let doc = html.content
  if (css) doc = doc.replace('</head>', '<style>' + css + '</style></head>')
  if (js) doc = doc.replace('</body>', '<script>' + js + '<' + '/script></body>')
  return doc
}

function buildReactPreview(files) {
  const jsxFile = files.find(f => ['jsx','tsx','js','ts'].includes(f.lang) &&
    /import\s+React|from\s+['"]react['"]|export\s+default\s+function|export\s+default\s+const/.test(f.content))
  if (!jsxFile) return null

  const cssContent = files.filter(f => f.lang === 'css' || f.lang === 'scss').map(f => f.content).join('\n')

  let code = jsxFile.content
  // Strip all import statements
  code = code.replace(/^import\s[\s\S]*?from\s+['"][^'"]+['"];?\s*$/gm, '')
  code = code.replace(/^import\s+['"][^'"]+['"];?\s*$/gm, '')
  // Handle exports
  code = code.replace(/export\s+default\s+function\s+(\w+)/, 'function $1')
  code = code.replace(/export\s+default\s+class\s+(\w+)/, 'class $1')
  code = code.replace(/^export\s+(const|function|class|let|var)\s+/gm, '$1 ')
  code = code.replace(/^export\s+default\s+/gm, '')

  const nameMatch = jsxFile.content.match(/export\s+default\s+(?:function\s+|class\s+)?(\w+)/)
  const componentName = nameMatch?.[1] || 'App'

  return [
    '<!DOCTYPE html><html><head>',
    '<meta charset="UTF-8"/>',
    '<meta name="viewport" content="width=device-width,initial-scale=1"/>',
    '<script src="https://unpkg.com/react@18/umd/react.development.js" crossorigin><' + '/script>',
    '<script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js" crossorigin><' + '/script>',
    '<script src="https://unpkg.com/@babel/standalone/babel.min.js"><' + '/script>',
    '<script src="https://cdn.tailwindcss.com"><' + '/script>',
    '<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet"/>',
    '<style>*{box-sizing:border-box}body{margin:0;font-family:Inter,system-ui,sans-serif;background:#f9fafb}' + cssContent + '</style>',
    '</head><body><div id="root"></div>',
    '<script>',
    'window.useState=React.useState;window.useEffect=React.useEffect;window.useRef=React.useRef;',
    'window.useCallback=React.useCallback;window.useMemo=React.useMemo;window.useContext=React.useContext;',
    'window.useReducer=React.useReducer;window.createContext=React.createContext;',
    'window.lucideReact=new Proxy({},{get:(_,n)=>({[n]:()=>React.createElement("span",{style:{display:"inline-block",width:16,height:16,background:"#ccc",borderRadius:2}})})});',
    '<' + '/script>',
    '<script type="text/babel" data-presets="react,typescript">',
    'const {useState,useEffect,useRef,useCallback,useMemo,useContext,useReducer,createContext}=React;',
    code,
    'try{ReactDOM.createRoot(document.getElementById("root")).render(React.createElement(' + componentName + '));}',
    'catch(e){document.getElementById("root").innerHTML="<div style=\'padding:20px;color:red;font-family:monospace\'>Error: "+e.message+"</div>";}',
    '<' + '/script></body></html>',
  ].join('\n')
}

// ── Preview Modal ─────────────────────────────────────────────────────────
function PreviewModal({ files, type, onClose }) {
  const iframeRef = useRef(null)
  const [device, setDevice] = useState('desktop')

  const htmlContent = type === 'html' ? buildHTMLPreview(files) : buildReactPreview(files)

  useEffect(() => {
    if (!iframeRef.current || !htmlContent) return
    const doc = iframeRef.current.contentDocument || iframeRef.current.contentWindow?.document
    if (doc) { doc.open(); doc.write(htmlContent); doc.close() }
  }, [htmlContent, device])

  const widths = { desktop: '100%', tablet: '768px', mobile: '375px' }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(8px)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 16,
    }}>
      <div style={{ width: '100%', maxWidth: 1100, display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          {[['desktop','🖥 Desktop'],['tablet','⬛ Tablet'],['mobile','📱 Mobile']].map(([d, label]) => (
            <button key={d} onClick={() => setDevice(d)} style={{
              padding: '6px 14px', borderRadius: 100, border: 'none', cursor: 'pointer',
              background: device === d ? '#007AFF' : 'rgba(255,255,255,0.12)',
              color: device === d ? '#fff' : 'rgba(255,255,255,0.75)',
              fontSize: '0.78rem', fontWeight: 500, transition: 'all 0.2s',
            }}>{label}</button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.75rem' }}>
            {type === 'react' ? 'React Preview' : 'HTML Preview'}
          </span>
          <button onClick={onClose} style={{
            background: 'rgba(255,255,255,0.12)', border: 'none', color: '#fff',
            width: 32, height: 32, borderRadius: '50%', cursor: 'pointer',
            fontSize: '1.2rem', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>×</button>
        </div>
      </div>

      <div style={{
        width: '100%', maxWidth: 1100, flex: 1, background: '#fff', borderRadius: 16,
        overflow: 'hidden', boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
        display: 'flex', justifyContent: 'center',
      }}>
        <iframe
          ref={iframeRef}
          title="preview"
          sandbox="allow-scripts allow-same-origin"
          style={{ width: widths[device], maxWidth: '100%', height: '100%', border: 'none', transition: 'width 0.3s' }}
        />
      </div>
    </div>
  )
}

function PreviewButton({ files, type }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button onClick={() => setOpen(true)} style={{
        display: 'inline-flex', alignItems: 'center', gap: 7,
        padding: '9px 18px', marginTop: 14, marginRight: 8,
        background: 'rgba(88,86,214,0.08)', border: '1px solid rgba(88,86,214,0.2)',
        borderRadius: 100, color: '#5856d6', cursor: 'pointer',
        fontSize: '0.82rem', fontWeight: 500, fontFamily: 'DM Sans,sans-serif', transition: 'all 0.2s',
      }}
        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(88,86,214,0.15)'; e.currentTarget.style.transform = 'translateY(-1px)' }}
        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(88,86,214,0.08)'; e.currentTarget.style.transform = 'none' }}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="5 3 19 12 5 21 5 3"/>
        </svg>
        Preview
      </button>
      {open && <PreviewModal files={files} type={type} onClose={() => setOpen(false)} />}
    </>
  )
}

// ── ZIP Button ─────────────────────────────────────────────────────────────
function ZipButton({ files, projectName }) {
  const [state, setState] = useState('idle')

  async function downloadZip() {
    setState('loading')
    try {
      const session = await supabase.auth.getSession()
      const token = session.data.session?.access_token
      const res = await fetch(import.meta.env.VITE_SUPABASE_URL + '/functions/v1/generate-zip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token, apikey: import.meta.env.VITE_SUPABASE_ANON_KEY },
        body: JSON.stringify({ files, projectName }),
      })
      if (!res.ok) throw new Error(await res.text())
      const blob = await res.blob()
      const blobUrl = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = blobUrl; a.download = projectName + '.zip'; a.click()
      setTimeout(() => URL.revokeObjectURL(blobUrl), 5000)
      setState('done'); setTimeout(() => setState('idle'), 3000)
    } catch (err) {
      console.error('ZIP error:', err)
      setState('error'); setTimeout(() => setState('idle'), 3000)
    }
  }

  const cfgs = {
    idle:    { label: 'Download ZIP',   bg: 'rgba(0,122,255,0.08)',  color: '#007AFF', border: 'rgba(0,122,255,0.2)' },
    loading: { label: 'Building…',      bg: 'rgba(0,122,255,0.05)',  color: '#007AFF', border: 'rgba(0,122,255,0.15)' },
    done:    { label: '✓ Downloaded',   bg: 'rgba(52,199,89,0.1)',   color: '#1a7a35', border: 'rgba(52,199,89,0.25)' },
    error:   { label: 'Failed — retry', bg: 'rgba(255,59,48,0.08)',  color: '#cc2200', border: 'rgba(255,59,48,0.2)' },
  }
  const cfg = cfgs[state]

  return (
    <button onClick={downloadZip} disabled={state === 'loading'} style={{
      display: 'inline-flex', alignItems: 'center', gap: 8, padding: '9px 18px', marginTop: 14,
      background: cfg.bg, border: '1px solid ' + cfg.border, borderRadius: 100, color: cfg.color,
      cursor: state === 'loading' ? 'not-allowed' : 'pointer',
      fontSize: '0.82rem', fontWeight: 500, fontFamily: 'DM Sans,sans-serif', transition: 'all 0.2s',
    }}
      onMouseEnter={e => { if (state === 'idle') { e.currentTarget.style.background = 'rgba(0,122,255,0.14)'; e.currentTarget.style.transform = 'translateY(-1px)' }}}
      onMouseLeave={e => { e.currentTarget.style.background = cfg.bg; e.currentTarget.style.transform = 'none' }}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
      </svg>
      {cfg.label}
      {state === 'idle' && <span style={{ fontSize: '0.72rem', opacity: 0.6, marginLeft: 2 }}>{files.length} file{files.length !== 1 ? 's' : ''}</span>}
    </button>
  )
}

async function downloadImage(imgUrl) {
  try {
    const res = await fetch(imgUrl); const blob = await res.blob()
    const blobUrl = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = blobUrl; a.download = 'orion-' + Date.now() + '.jpg'; a.click()
    setTimeout(() => URL.revokeObjectURL(blobUrl), 5000)
  } catch {
    const a = document.createElement('a'); a.href = imgUrl; a.download = 'orion-' + Date.now() + '.jpg'; a.click()
  }
}

function ImageMessage({ imgUrl, prompt }) {
  return (
    <div>
      <img src={imgUrl} alt="Generated" style={{ maxWidth: 480, width: '100%', borderRadius: 16, marginBottom: 10, display: 'block', boxShadow: '0 8px 32px rgba(0,0,0,0.1)' }} />
      <button onClick={() => downloadImage(imgUrl)} style={{
        display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 18px',
        background: 'rgba(0,122,255,0.08)', border: '1px solid rgba(0,122,255,0.2)',
        borderRadius: 100, color: '#007AFF', cursor: 'pointer',
        fontSize: '0.82rem', fontWeight: 500, fontFamily: 'DM Sans,sans-serif', transition: 'all 0.2s',
      }}
        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,122,255,0.15)'; e.currentTarget.style.transform = 'translateY(-1px)' }}
        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(0,122,255,0.08)'; e.currentTarget.style.transform = 'none' }}
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
  const projectName = deriveProjectName(codeFiles)
  const previewable = (!streaming && isAI) ? getPreviewable(codeFiles) : null

  useEffect(() => {
    if (!bubbleRef.current || !isAI || streaming || imageMatch || storedImgMatch) return
    addCopyButtons(bubbleRef.current)
  }, [content, streaming, isAI, imageMatch, storedImgMatch])

  const wrapStyle = {
    display: 'flex', gap: 10, animation: 'fadeUp 0.2s ease both',
    flexDirection: isAI ? 'row' : 'row-reverse', alignItems: 'flex-start',
  }
  const avatarStyle = {
    width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '0.7rem', fontWeight: 600,
    background: isAI ? 'linear-gradient(135deg,rgba(0,122,255,0.15),rgba(88,86,214,0.15))' : 'rgba(0,0,0,0.06)',
    border: isAI ? '1px solid rgba(0,122,255,0.2)' : '1px solid rgba(0,0,0,0.08)',
    color: isAI ? '#007AFF' : '#4a5568', marginTop: 2,
  }
  const bubbleStyle = {
    padding: '11px 15px', borderRadius: isAI ? '4px 16px 16px 16px' : '16px 4px 16px 16px',
    fontSize: '0.88rem', maxWidth: 'calc(100% - 50px)', wordBreak: 'break-word', lineHeight: 1.6,
    background: isAI ? 'rgba(255,255,255,0.72)' : 'rgba(0,122,255,0.09)',
    border: isAI ? '1px solid rgba(255,255,255,0.9)' : '1px solid rgba(0,122,255,0.18)',
    backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
    boxShadow: isAI ? '0 2px 12px rgba(100,120,180,0.08)' : '0 2px 12px rgba(0,122,255,0.06)',
    whiteSpace: isAI ? undefined : 'pre-wrap', color: '#1a1d23',
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
      <div style={{ ...bubbleStyle, padding: (showZip || previewable) ? '11px 15px 15px' : '11px 15px' }} className="bubble" ref={bubbleRef}>
        <div dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }} />
        <div style={{ display: 'flex', flexWrap: 'wrap' }}>
          {previewable && <PreviewButton files={codeFiles} type={previewable.type} />}
          {showZip && <ZipButton files={codeFiles} projectName={projectName} />}
        </div>
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