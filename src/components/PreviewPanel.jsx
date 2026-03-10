import { useEffect, useRef, useState } from 'react'

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
  code = code.replace(/^import\s[\s\S]*?from\s+['"][^'"]+['"];?\s*$/gm, '')
  code = code.replace(/^import\s+['"][^'"]+['"];?\s*$/gm, '')
  code = code.replace(/export\s+default\s+function\s+(\w+)/, 'function $1')
  code = code.replace(/export\s+default\s+class\s+(\w+)/, 'class $1')
  code = code.replace(/^export\s+(const|function|class|let|var)\s+/gm, '$1 ')
  code = code.replace(/^export\s+default\s+/gm, '')
  const nameMatch = jsxFile.content.match(/export\s+default\s+(?:function\s+|class\s+)?(\w+)/)
  const componentName = nameMatch?.[1] || 'App'
  return [
    '<!DOCTYPE html><html><head>',
    '<meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>',
    '<script src="https://unpkg.com/react@18/umd/react.development.js" crossorigin><' + '/script>',
    '<script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js" crossorigin><' + '/script>',
    '<script src="https://unpkg.com/@babel/standalone/babel.min.js"><' + '/script>',
    '<script src="https://cdn.tailwindcss.com"><' + '/script>',
    '<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet"/>',
    '<style>*{box-sizing:border-box}body{margin:0;font-family:Inter,system-ui,sans-serif;background:#f9fafb}' + cssContent + '</style>',
    '</head><body><div id="root"></div>',
    '<script>window.useState=React.useState;window.useEffect=React.useEffect;window.useRef=React.useRef;window.useCallback=React.useCallback;window.useMemo=React.useMemo;window.useContext=React.useContext;window.useReducer=React.useReducer;window.createContext=React.createContext;<' + '/script>',
    '<script type="text/babel" data-presets="react,typescript">',
    'const {useState,useEffect,useRef,useCallback,useMemo,useContext,useReducer,createContext}=React;',
    code,
    'try{ReactDOM.createRoot(document.getElementById("root")).render(React.createElement(' + componentName + '));}',
    'catch(e){document.getElementById("root").innerHTML="<div style=\'padding:20px;color:red;font-family:monospace\'>Error: "+e.message+"</div>";}',
    '<' + '/script></body></html>',
  ].join('\n')
}

export default function PreviewPanel({ files, type, onClose }) {
  const iframeRef = useRef(null)
  const [device, setDevice] = useState('desktop')

  const htmlContent = type === 'html' ? buildHTMLPreview(files) : buildReactPreview(files)

  useEffect(() => {
    if (!iframeRef.current || !htmlContent) return
    const doc = iframeRef.current.contentDocument || iframeRef.current.contentWindow?.document
    if (doc) { doc.open(); doc.write(htmlContent); doc.close() }
  }, [htmlContent, device])

  const iframeWidths = { desktop: '100%', tablet: '420px', mobile: '320px' }

  return (
    <div style={{
      width: '100%', height: '100%',
      display: 'flex', flexDirection: 'column',
      background: 'rgba(250,251,253,0.98)',
      borderLeft: '1px solid rgba(0,0,0,0.08)',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 14px', flexShrink: 0,
        background: 'rgba(255,255,255,0.9)',
        borderBottom: '1px solid rgba(0,0,0,0.07)',
      }}>
        <div style={{ display: 'flex', gap: 4, background: 'rgba(0,0,0,0.05)', borderRadius: 10, padding: 3 }}>
          {[['desktop','🖥 Desktop'],['tablet','⬜ Tablet'],['mobile','📱 Mobile']].map(([d, label]) => (
            <button key={d} onClick={() => setDevice(d)} style={{
              padding: '4px 10px', borderRadius: 7, border: 'none', cursor: 'pointer',
              background: device === d ? '#fff' : 'transparent',
              boxShadow: device === d ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
              fontSize: '0.75rem', fontWeight: 500,
              color: device === d ? '#1a1d23' : '#8a95a8',
              transition: 'all 0.15s',
            }}>{label}</button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{
            fontSize: '0.7rem', fontWeight: 500, padding: '3px 9px', borderRadius: 100,
            background: type === 'react' ? 'rgba(0,122,255,0.08)' : 'rgba(52,199,89,0.08)',
            color: type === 'react' ? '#007AFF' : '#1a7a35',
            border: type === 'react' ? '1px solid rgba(0,122,255,0.18)' : '1px solid rgba(52,199,89,0.18)',
          }}>{type === 'react' ? '⚛ React' : '🌐 HTML'}</span>
          <button onClick={onClose} style={{
            background: 'rgba(0,0,0,0.05)', border: 'none', color: '#4a5568',
            width: 28, height: 28, borderRadius: '50%', cursor: 'pointer',
            fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,59,48,0.1)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(0,0,0,0.05)'}
          >×</button>
        </div>
      </div>

      {/* iframe */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#e5e7eb', padding: device === 'desktop' ? 0 : 16 }}>
        <div style={{
          width: iframeWidths[device], height: '100%', background: '#fff',
          boxShadow: device !== 'desktop' ? '0 8px 32px rgba(0,0,0,0.15)' : 'none',
          borderRadius: device !== 'desktop' ? 16 : 0,
          overflow: 'hidden', transition: 'all 0.3s',
        }}>
          <iframe ref={iframeRef} title="preview" sandbox="allow-scripts allow-same-origin"
            style={{ width: '100%', height: '100%', border: 'none' }} />
        </div>
      </div>
    </div>
  )
}