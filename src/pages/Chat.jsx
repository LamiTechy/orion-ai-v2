import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '../context/AuthContext'
import { useConversations } from '../hooks/useConversations'
import { streamEdgeFunction, callEdgeFunction, supabase } from '../lib/supabase'
import MessageBubble from '../components/MessageBubble'
import CallMode from '../components/CallMode'

const CSS = `
  .chat-app {
    display:flex;
    height: 100vh;
    height: 100dvh;
    overflow: hidden;
    position: relative;
    z-index: 1;
  }

  /* ── Sidebar ── */
  .sidebar {
    width:272px; flex-shrink:0;
    display:flex; flex-direction:column;
    background: rgba(255,255,255,0.5);
    backdrop-filter: blur(24px) saturate(180%);
    -webkit-backdrop-filter: blur(24px) saturate(180%);
    border-right: 1px solid rgba(255,255,255,0.8);
    box-shadow: 2px 0 20px rgba(100,120,180,0.06);
  }
  .sidebar-header {
    padding: 20px 16px 16px;
    border-bottom: 1px solid rgba(255,255,255,0.6);
    display:flex; align-items:center; justify-content:space-between;
  }
  .s-logo { font-family:'DM Serif Display',serif; font-size:1.3rem; color:#1a1d23; }
  .s-logo span { color:#007AFF; }
  .new-btn {
    background: #007AFF; color:#fff; border:none;
    padding: 7px 14px; border-radius:100px;
    font-size:0.78rem; font-weight:600; cursor:pointer;
    transition:all 0.2s; box-shadow:0 3px 10px rgba(0,122,255,0.25);
  }
  .new-btn:hover { background:#0066dd; transform:translateY(-1px); }

  .conv-list { flex:1; overflow-y:auto; padding:10px; }
  .conv-item {
    padding: 10px 12px; border-radius: 12px; cursor:pointer;
    margin-bottom:4px; display:flex; align-items:center;
    justify-content:space-between; transition:all 0.15s;
    border: 1px solid transparent;
  }
  .conv-item:hover { background:rgba(255,255,255,0.65); border-color:rgba(255,255,255,0.8); }
  .conv-item.active {
    background: rgba(0,122,255,0.08);
    border-color: rgba(0,122,255,0.2);
  }
  .conv-title { font-size:0.83rem; color:#1a1d23; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; flex:1; font-weight:450; }
  .conv-item.active .conv-title { color:#007AFF; font-weight:550; }
  .del-btn { opacity:0; background:none; border:none; color:#b0bac8; cursor:pointer; font-size:1rem; padding:3px 6px; border-radius:6px; transition:all 0.15s; }
  .conv-item:hover .del-btn { opacity:1; }
  .del-btn:hover { color:#ff3b30; background:rgba(255,59,48,0.08); }
  .empty-sidebar { padding:32px 16px; text-align:center; color:#b0bac8; font-size:0.82rem; }

  .sidebar-footer {
    border-top: 1px solid rgba(255,255,255,0.6);
  }
  .user-row { display:flex; align-items:center; gap:10px; padding:14px 16px; }
  .user-av {
    width:34px; height:34px; border-radius:50%; flex-shrink:0;
    background: linear-gradient(135deg, #007AFF, #5856d6);
    display:flex; align-items:center; justify-content:center;
    font-weight:600; font-size:0.82rem; color:#fff;
    box-shadow: 0 3px 10px rgba(0,122,255,0.25);
  }
  .user-email { font-size:0.78rem; color:#4a5568; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; flex:1; min-width:0; }
  .logout-btn { background:none; border:none; color:#b0bac8; cursor:pointer; padding:6px; border-radius:8px; font-size:1rem; transition:all 0.15s; }
  .logout-btn:hover { background:rgba(255,59,48,0.08); color:#ff3b30; }

  /* ── Main ── */
  .main { flex:1; display:flex; flex-direction:column; min-width:0; }

  .chat-header {
    display:flex; align-items:center; justify-content:space-between;
    padding: 16px 24px;
    background: rgba(255,255,255,0.5);
    backdrop-filter: blur(20px) saturate(180%);
    -webkit-backdrop-filter: blur(20px) saturate(180%);
    border-bottom: 1px solid rgba(255,255,255,0.75);
  }
  .header-left { display:flex; align-items:center; gap:12px; }
  .hamburger { display:none; background:none; border:none; color:#4a5568; cursor:pointer; font-size:1.3rem; padding:4px 6px; border-radius:8px; }
  .chat-title { font-size:0.92rem; font-weight:600; color:#1a1d23; }
  .clear-btn {
    background: rgba(255,255,255,0.65); border:1px solid rgba(0,0,0,0.07);
    color:#4a5568; padding:6px 16px; border-radius:100px;
    cursor:pointer; font-size:0.78rem; font-weight:500;
    transition:all 0.2s; backdrop-filter:blur(8px);
  }
  .clear-btn:hover { background:rgba(255,59,48,0.07); color:#cc2200; border-color:rgba(255,59,48,0.15); }

  /* ── Chat area ── */
  .chat-area {
    flex:1; overflow-y:auto; padding:28px 24px;
    display:flex; flex-direction:column; gap:16px;
  }
  .empty-state {
    flex:1; display:flex; flex-direction:column;
    align-items:center; justify-content:center; gap:12px;
    text-align:center; padding:40px;
  }
  .empty-orb {
    width:72px; height:72px; border-radius:50%;
    background: linear-gradient(135deg, rgba(0,122,255,0.15), rgba(88,86,214,0.15));
    border: 1px solid rgba(0,122,255,0.2);
    display:flex; align-items:center; justify-content:center;
    font-family:'DM Serif Display',serif; font-size:1.5rem; color:#007AFF;
    backdrop-filter:blur(8px); margin-bottom:4px;
  }
  .empty-state h2 { font-family:'DM Serif Display',serif; font-size:1.8rem; color:#1a1d23; font-weight:400; }
  .empty-state p { color:#8a95a8; font-size:0.9rem; }

  /* ── Input area ── */
  .input-area {
    padding: 16px 24px 20px;
    background: rgba(255,255,255,0.5);
    backdrop-filter: blur(20px) saturate(180%);
    -webkit-backdrop-filter: blur(20px) saturate(180%);
    border-top: 1px solid rgba(255,255,255,0.75);
  }
  .file-chip {
    display:inline-flex; align-items:center; gap:8px;
    background: rgba(0,122,255,0.07); border:1px solid rgba(0,122,255,0.18);
    border-radius:100px; padding:6px 12px 6px 10px;
    margin-bottom:10px; animation:slideDown 0.2s ease;
  }
  .file-chip-name { font-size:0.82rem; color:#0055cc; font-weight:500; max-width:200px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .file-chip-remove { background:none; border:none; color:#b0bac8; cursor:pointer; font-size:1.1rem; line-height:1; padding:0 2px; }
  .file-chip-remove:hover { color:#ff3b30; }

  .input-box {
    display:flex; gap:8px; align-items:flex-end;
    background: rgba(255,255,255,0.72);
    backdrop-filter: blur(16px) saturate(180%);
    -webkit-backdrop-filter: blur(16px) saturate(180%);
    border: 1px solid rgba(255,255,255,0.9);
    border-radius: 20px; padding: 10px 10px 10px 14px;
    box-shadow: 0 4px 20px rgba(100,120,180,0.1), inset 0 1px 0 rgba(255,255,255,0.8);
    transition: box-shadow 0.2s, border-color 0.2s;
  }
  .input-box:focus-within {
    border-color: rgba(0,122,255,0.35);
    box-shadow: 0 0 0 4px rgba(0,122,255,0.07), 0 4px 20px rgba(100,120,180,0.1);
  }
  .input-box.locked { opacity: 0.55; pointer-events: none; cursor: not-allowed; }
  .input-textarea:disabled { cursor: not-allowed; }
  .input-textarea {
    flex:1; background:none; border:none; outline:none;
    color:#1a1d23; font-family:'DM Sans',sans-serif; font-size:0.92rem;
    resize:none; min-height:24px; max-height:160px; padding:4px 0;
    line-height:1.55;
  }
  .input-textarea::placeholder { color:#b0bac8; }
  .input-actions { display:flex; gap:6px; align-items:flex-end; flex-shrink:0; }
  .icon-btn {
    width:34px; height:34px; border-radius:50%; border:none;
    background: transparent; color:#a0aab8;
    display:flex; align-items:center; justify-content:center;
    cursor:pointer; transition:all 0.18s; flex-shrink:0; padding:0;
  }
  .icon-btn:hover { background:rgba(0,0,0,0.06); color:#4a5568; }
  .icon-btn.listening { background:rgba(255,59,48,0.08); color:#ff3b30; animation:micPulse 1s infinite; }
  .icon-btn svg { display:block; }
  .send-btn {
    width:38px; height:38px; border-radius:12px; border:none;
    background: #007AFF; color:#fff;
    display:flex; align-items:center; justify-content:center;
    cursor:pointer; transition:all 0.2s;
    box-shadow: 0 3px 10px rgba(0,122,255,0.3);
  }
  .send-btn:hover { background:#0066dd; transform:scale(1.05); box-shadow:0 4px 14px rgba(0,122,255,0.4); }
  .send-btn:disabled { opacity:0.4; cursor:not-allowed; transform:none; }
  .send-btn svg { width:16px; height:16px; fill:#fff; }

  .status-row { display:flex; align-items:center; gap:6px; padding-top:8px; }
  .status-dot { width:5px; height:5px; border-radius:50%; background:#34c759; flex-shrink:0; }
  .status-dot.loading { background:#007AFF; animation:pulse 1s infinite; }
  .status-text { font-size:0.72rem; color:#b0bac8; }

  /* ── Mobile ── */
  @media (max-width:768px) {
    .chat-app { flex-direction: column; height: 100vh; height: 100dvh; }
    .sidebar {
      position: fixed; left: 0; top: 0;
      width: 280px; height: 100vh; height: 100dvh;
      z-index: 1000; transform: translateX(-100%); transition: transform 0.28s ease;
    }
    .sidebar.open { transform: translateX(0); box-shadow: 4px 0 32px rgba(0,0,0,0.18); }
    .hamburger { display: block; }
    .overlay { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.25); backdrop-filter: blur(2px); z-index: 999; }
    .overlay.open { display: block; }
    .main { flex: 1; display: flex; flex-direction: column; min-height: 0; overflow: hidden; width: 100%; }
    .chat-header { flex-shrink: 0; padding: 10px 14px; min-height: 52px; background: rgba(255,255,255,0.97); backdrop-filter: blur(20px) saturate(200%); -webkit-backdrop-filter: blur(20px) saturate(200%); border-bottom: 1px solid rgba(0,0,0,0.08); z-index: 10; }
    .chat-area { flex: 1; min-height: 0; overflow-y: auto; overflow-x: hidden; padding: 12px 12px 8px; -webkit-overflow-scrolling: touch; overscroll-behavior: contain; }
    .input-area { flex-shrink: 0; padding: 8px 12px; padding-bottom: max(10px, env(safe-area-inset-bottom)); background: rgba(255,255,255,0.97); backdrop-filter: blur(20px) saturate(200%); -webkit-backdrop-filter: blur(20px) saturate(200%); border-top: 1px solid rgba(0,0,0,0.08); }
    .input-box { border-radius: 24px; padding: 8px 8px 8px 14px; }
    .input-textarea { font-size: 1rem; }
    .send-btn { width: 40px; height: 40px; border-radius: 50%; }
    .file-chip { margin-bottom: 8px; }
    .file-chip-name { max-width: 150px; }
    .status-row { padding-top: 4px; }
  }
`

export default function Chat() {
  const { user, signOut } = useAuth()
  const { conversations, load, create, remove, updateTitle, getMessages, saveMessage } = useConversations(user?.id)

  const [messages, setMessages]           = useState([])
  const [conversationId, setConversationId] = useState(null)
  const [input, setInput]                 = useState('')
  const [isStreaming, setIsStreaming]     = useState(false)
  const [status, setStatus]               = useState('Ready')
  const [statusLoading, setStatusLoading] = useState(false)
  const [sidebarOpen, setSidebarOpen]     = useState(false)
  const [uploadedFile, setUploadedFile]   = useState(null)
  const [fileContent, setFileContent]     = useState(null)
  const [isImageFile, setIsImageFile]     = useState(false)
  const [imageUrl, setImageUrl]           = useState(null)
  const [isListening, setIsListening]     = useState(false)
  const [callActive, setCallActive]       = useState(false)
  const [githubUser, setGithubUser]       = useState(null)
  const [githubLoading, setGithubLoading] = useState(false)

  const recognitionRef  = useRef(null)
  const chatAreaRef     = useRef(null)
  const textareaRef     = useRef(null)
  const fileInputRef    = useRef(null)
  const typeQueueRef    = useRef([])
  const typeTimerRef    = useRef(null)
  const typeDisplayRef  = useRef('')
  const typeDoneRef     = useRef(false)

  function startTypewriter() {
    if (typeTimerRef.current) return
    const TARGET_CPS = 55
    let lastTime = null
    let charBudget = 0
    function tick(now) {
      if (!lastTime) lastTime = now
      const elapsed = now - lastTime
      lastTime = now
      charBudget += (elapsed / 1000) * TARGET_CPS
      const queue = typeQueueRef.current
      let rendered = 0
      while (queue.length > 0 && charBudget >= 1) {
        typeDisplayRef.current += queue.shift()
        charBudget -= 1
        rendered++
      }
      if (rendered > 0) {
        const text = typeDisplayRef.current
        setMessages(prev => {
          const n = [...prev]
          n[n.length - 1] = { role: 'assistant', content: text, streaming: true }
          return n
        })
      }
      if (queue.length > 0 || !typeDoneRef.current) {
        typeTimerRef.current = requestAnimationFrame(tick)
      } else {
        typeTimerRef.current = null
        const final = typeDisplayRef.current
        setMessages(prev => {
          const n = [...prev]
          n[n.length - 1] = { role: 'assistant', content: final, streaming: false }
          return n
        })
        setStatus('Ready')
        setStatusLoading(false)
        load()
        removeFile()
      }
    }
    typeTimerRef.current = requestAnimationFrame(tick)
  }

  function resetTypewriter() {
    if (typeTimerRef.current) { cancelAnimationFrame(typeTimerRef.current); typeTimerRef.current = null }
    const remaining = typeQueueRef.current.join('')
    const final = typeDisplayRef.current + remaining
    if (final) {
      setMessages(prev => {
        const n = [...prev]
        if (n.length > 0 && n[n.length - 1].streaming) n[n.length - 1] = { role: 'assistant', content: final, streaming: false }
        return n
      })
    }
    typeQueueRef.current = []
    typeDisplayRef.current = ''
    typeDoneRef.current = false
  }

  // Init: load conversations + restore last active
  useEffect(() => {
    async function init() {
      await load()
      const savedId = localStorage.getItem('orion_last_conv')
      if (savedId) {
        try {
          const msgs = await getMessages(savedId)
          if (msgs && msgs.length > 0) {
            setConversationId(savedId)
            setMessages(msgs.map(m => ({ role: m.role, content: m.content })))
          } else { localStorage.removeItem('orion_last_conv') }
        } catch { localStorage.removeItem('orion_last_conv') }
      }
    }
    init()
  }, [])

  // GitHub: check connection on mount + handle OAuth callback
  useEffect(() => {
    async function checkGitHub() {
      if (!user?.id) return
      const { data } = await supabase
        .from('user_github_tokens')
        .select('github_login, github_name, avatar_url')
        .eq('user_id', user.id)
        .single()
      if (data?.github_login) setGithubUser(data)
    }
    checkGitHub()
    const params = new URLSearchParams(window.location.search)
    if (params.get('github_connected')) {
      checkGitHub()
      window.history.replaceState({}, '', '/chat')
    }
    if (params.get('github_error')) {
      alert('GitHub connection failed: ' + params.get('github_error'))
      window.history.replaceState({}, '', '/chat')
    }
  }, [user?.id])

  async function connectGitHub() {
    if (!user?.id) return
    setGithubLoading(true)
    const clientId    = import.meta.env.VITE_GITHUB_CLIENT_ID
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
    const callbackUrl = `${supabaseUrl}/functions/v1/github-oauth-callback`
    const scope       = 'repo,read:user'
    window.location.href = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(callbackUrl)}&scope=${scope}&state=${user.id}`
  }

  async function disconnectGitHub() {
    if (!user?.id) return
    await supabase.from('user_github_tokens').delete().eq('user_id', user.id)
    setGithubUser(null)
  }

  // Track when preview panel has content
  useEffect(() => {
    const el = document.getElementById('orion-preview-root')
    if (!el) return
    const obs = new MutationObserver(() => setPreviewOpen(el.children.length > 0))
    obs.observe(el, { childList: true })
    return () => obs.disconnect()
  }, [])

  const scrollToBottom = useCallback(() => {
    setTimeout(() => { chatAreaRef.current?.scrollTo({ top: chatAreaRef.current.scrollHeight, behavior: 'smooth' }) }, 0)
  }, [])
  useEffect(() => { scrollToBottom() }, [messages, scrollToBottom])

  useEffect(() => { window.__reactDom = { createPortal } }, [])

  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition
      const rec = new SR()
      rec.continuous = false; rec.interimResults = true
      rec.onstart = () => { setIsListening(true); setStatus('🎤 Listening…'); setStatusLoading(true) }
      rec.onresult = e => setInput(Array.from(e.results).map(r => r[0].transcript).join(''))
      rec.onend = () => { setIsListening(false); setStatus('Ready'); setStatusLoading(false) }
      rec.onerror = () => { setIsListening(false); setStatus('Ready'); setStatusLoading(false) }
      recognitionRef.current = rec
    }
  }, [])

  function toggleMic() {
    if (!recognitionRef.current) return
    isListening ? recognitionRef.current.stop() : recognitionRef.current.start()
  }

  async function switchConversation(id) {
    setConversationId(id)
    localStorage.setItem('orion_last_conv', id)
    const msgs = await getMessages(id)
    setMessages(msgs.map(m => ({ role: m.role, content: m.content })))
    setSidebarOpen(false)
  }

  function newChat() { setConversationId(null); setMessages([]); removeFile(); localStorage.removeItem('orion_last_conv') }

  async function deleteConversation(id) {
    await remove(id)
    if (id === conversationId) newChat()
  }

  async function handleFileChange(e) {
    const file = e.target.files[0]
    if (!file) return
    if (file.size > 20 * 1024 * 1024) { alert('File too large. Max 20MB.'); return }
    setUploadedFile(file)
    setStatus(file.type.startsWith('image/') ? 'Analysing image…' : 'Processing file…')
    setStatusLoading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const session = await supabase.auth.getSession()
      const token = session.data.session?.access_token
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
      const res = await fetch(`${supabaseUrl}/functions/v1/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, apikey: supabaseAnonKey },
        body: formData,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Upload failed')
      setFileContent(data.content); setIsImageFile(data.isImage); setImageUrl(data.imageUrl || null)
      setStatus(`✓ ${file.name}`); setStatusLoading(false)
    } catch (err) { alert('Upload failed: ' + err.message); removeFile() }
  }

  function removeFile() {
    setUploadedFile(null); setFileContent(null); setIsImageFile(false); setImageUrl(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
    setStatus('Ready'); setStatusLoading(false)
  }

  async function sendMessage() {
    const text = input.trim()
    if (!text || isStreaming) return

    if (isImageFile && imageUrl) {
      const analysisKeywords = ['what','who','where','when','why','how many','describe','explain','identify','tell me','analyse','analyze','read','extract','transcribe','summarize','summarise','caption','detect','find','is there','are there','count','list','show me','can you see','do you see','look at','check']
      const editKeywords = ['edit','change','modify','make it','turn it','convert','add a','add the','remove the','remove a','replace','apply','transform','adjust','crop','blur','sharpen','make the background','change the color','change the colour','make him','make her','make them','make the','put a','put the','give it','give him','give her','style it','filter','brighter','darker','lighter']
      const lower = text.toLowerCase()
      const wantsAnalysis = analysisKeywords.some(k => lower.includes(k))
      const wantsEdit = !wantsAnalysis && editKeywords.some(k => lower.includes(k))
      if (wantsEdit) { await handleImageEdit(text, text); return }
    }

    if (!uploadedFile) {
      try {
        const intent = await callEdgeFunction('classify-intent', { message: text })
        if (intent.isImage) { await handleImageGeneration(text, intent.prompt || text); return }
      } catch {}
    }

    resetTypewriter()
    setIsStreaming(true); setInput('')
    setMessages(prev => [...prev, { role: 'user', content: uploadedFile ? `📎 ${uploadedFile.name}\n${text}` : text }])
    setStatus('Thinking…'); setStatusLoading(true)
    setMessages(prev => [...prev, { role: 'assistant', content: '', streaming: true }])

    let convId = conversationId
    try {
      const res = await streamEdgeFunction('chat-stream', {
        message: text, conversationId: convId,
        fileContent, fileName: uploadedFile?.name,
        isImage: isImageFile, imageUrl, userId: user.id,
      })
      if (!res.ok) throw new Error('Stream failed')
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n'); buffer = lines.pop()
        for (const line of lines) {
          if (!line.startsWith('data:')) continue
          try {
            const data = JSON.parse(line.slice(5).trim())
            if (data.type === 'start') {
              convId = data.conversationId; setConversationId(convId)
              localStorage.setItem('orion_last_conv', convId)
              if (data.title) updateTitle(convId, data.title); load()
            } else if (data.type === 'searching') {
              setStatus('🔍 Searching the web…')
            } else if (data.type === 'delta') {
              for (const char of data.text) typeQueueRef.current.push(char)
              startTypewriter()
            } else if (data.type === 'done') {
              typeDoneRef.current = true
            }
          } catch {}
        }
      }
    } catch (err) {
      setMessages(prev => { const n=[...prev]; n[n.length-1]={role:'assistant',content:'⚠️ '+err.message,streaming:false}; return n })
      setStatus('Error'); setStatusLoading(false)
    } finally { setIsStreaming(false); textareaRef.current?.focus() }
  }

  async function handleImageGeneration(userText, prompt) {
    setInput('')
    setMessages(prev => [...prev, { role:'user', content:userText }])
    setMessages(prev => [...prev, { role:'assistant', content:'⏳ Generating image…', streaming:false }])
    setStatus('Generating image…'); setStatusLoading(true)
    try {
      const data = await callEdgeFunction('generate-image', { prompt, userId: user.id })
      if (!data.success) throw new Error(data.error || 'Failed')
      const src = `data:image/jpeg;base64,${data.image_data}`
      const imgUrl = data.image_url || src
      setMessages(prev => { const n=[...prev]; n[n.length-1]={role:'assistant',content:`__IMAGE__${imgUrl}__PROMPT__${prompt}`,streaming:false}; return n })
      await callEdgeFunction('save-image-messages', { conversationId, userMessage:userText, assistantMessage:`Generated image for: "${prompt}"\n![image](${imgUrl})`, userId:user.id })
      load()
    } catch (err) {
      setMessages(prev => { const n=[...prev]; n[n.length-1]={role:'assistant',content:'⚠ Image generation failed: '+err.message,streaming:false}; return n })
    } finally { setStatus('Ready'); setStatusLoading(false) }
  }

  async function handleImageEdit(userText, instruction) {
    setInput('')
    setMessages(prev => [...prev, { role:'user', content:`🖼️ Edit image: ${instruction}` }])
    setMessages(prev => [...prev, { role:'assistant', content:'⏳ Editing image…', streaming:false }])
    setStatus('Editing image…'); setStatusLoading(true)
    try {
      const data = await callEdgeFunction('edit-image', { imageUrl, instruction, userId: user.id })
      if (!data.success) throw new Error(data.error || 'Edit failed')
      const imgUrl = data.image_url || `data:image/jpeg;base64,${data.image_data}`
      setMessages(prev => { const n=[...prev]; n[n.length-1]={ role:'assistant', content:`__IMAGE__${imgUrl}__PROMPT__Edited: ${instruction}`, streaming:false }; return n })
      await callEdgeFunction('save-image-messages', { conversationId, userId: user.id, userMessage: `Edit image: ${instruction}`, assistantMessage: `Edited image: "${instruction}"\n![image](${imgUrl})` })
      load()
    } catch (err) {
      setMessages(prev => { const n=[...prev]; n[n.length-1]={ role:'assistant', content:'⚠ Image edit failed: '+err.message, streaming:false }; return n })
    } finally { removeFile(); setStatus('Ready'); setStatusLoading(false) }
  }

  function handleKeyDown(e) {
    if (e.key==='Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
  }

  function handleTextareaChange(e) {
    setInput(e.target.value)
    e.target.style.height = 'auto'
    e.target.style.height = Math.min(e.target.scrollHeight, 160) + 'px'
  }

  const currentTitle = conversationId ? conversations.find(c => c.id === conversationId)?.title || 'Chat' : 'New Chat'

  return (
    <>
      <style>{CSS}</style>
      <div className="chat-app">
        <div className={`overlay${sidebarOpen?' open':''}`} onClick={()=>setSidebarOpen(false)} />

        {/* Sidebar */}
        <div className={`sidebar${sidebarOpen?' open':''}`}>
          <div className="sidebar-header">
            <div className="s-logo">Orion<span>.</span></div>
            <button className="new-btn" onClick={newChat}>+ New</button>
          </div>
          <div className="conv-list">
            {conversations.length === 0
              ? <div className="empty-sidebar">No conversations yet</div>
              : conversations.map(c => (
                <div key={c.id} className={`conv-item${c.id===conversationId?' active':''}`} onClick={()=>switchConversation(c.id)}>
                  <div className="conv-title">{c.title}</div>
                  <button className="del-btn" onClick={e=>{e.stopPropagation();deleteConversation(c.id)}}>×</button>
                </div>
              ))
            }
          </div>
          <div className="sidebar-footer">
            {/* GitHub Connection */}
            <div style={{padding:'10px 12px', borderBottom:'1px solid rgba(255,255,255,0.5)'}}>
              {githubUser ? (
                <div style={{display:'flex',alignItems:'center',gap:8}}>
                  <img src={githubUser.avatar_url} alt="" style={{width:26,height:26,borderRadius:'50%',border:'1px solid rgba(0,0,0,0.1)',flexShrink:0}} />
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:'0.75rem',fontWeight:600,color:'#1a1d23',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                      {githubUser.github_login}
                    </div>
                    <div style={{fontSize:'0.67rem',color:'#34c759'}}>● GitHub connected</div>
                  </div>
                  <button onClick={disconnectGitHub} style={{background:'none',border:'none',color:'#b0bac8',cursor:'pointer',fontSize:'0.9rem',padding:'2px 5px',borderRadius:4,flexShrink:0}} title="Disconnect GitHub">✕</button>
                </div>
              ) : (
                <button
                  onClick={connectGitHub}
                  disabled={githubLoading}
                  style={{
                    width:'100%', padding:'8px 12px', borderRadius:10,
                    background:'#1a1d23', border:'none', color:'#fff',
                    display:'flex', alignItems:'center', gap:8,
                    cursor: githubLoading ? 'not-allowed' : 'pointer',
                    fontSize:'0.78rem', fontWeight:500,
                    opacity: githubLoading ? 0.6 : 1,
                    transition:'all 0.2s',
                  }}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/>
                  </svg>
                  {githubLoading ? 'Connecting…' : 'Connect GitHub'}
                </button>
              )}
            </div>
            {/* User row */}
            <div className="user-row">
              <div className="user-av">{user?.email?.[0]?.toUpperCase()}</div>
              <div className="user-email">{user?.email}</div>
              <button className="logout-btn" onClick={signOut} title="Sign out">↩</button>
            </div>
          </div>
        </div>

        {/* Main + Preview split */}
        <div style={{ flex: 1, display: 'flex', minWidth: 0, overflow: 'hidden' }}>
        <div className="main" style={{ flex: 1, minWidth: 0 }}>
          <div className="chat-header">
            <div className="header-left">
              <button className="hamburger" onClick={()=>setSidebarOpen(v=>!v)}>☰</button>
              <div className="chat-title">{currentTitle}</div>
            </div>
            <div style={{display:'flex',alignItems:'center',gap:8}}>
              <button
                onClick={()=>setCallActive(true)}
                style={{
                  display:'flex',alignItems:'center',justifyContent:'center',
                  gap:6, padding:'6px 14px', borderRadius:100,
                  background:'rgba(52,199,89,0.1)', border:'1px solid rgba(52,199,89,0.25)',
                  color:'#1a7a35', cursor:'pointer', fontSize:'0.78rem', fontWeight:500,
                  transition:'all 0.2s',
                }}
                onMouseEnter={e=>e.currentTarget.style.background='rgba(52,199,89,0.18)'}
                onMouseLeave={e=>e.currentTarget.style.background='rgba(52,199,89,0.1)'}
                title="Start voice call"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z"/>
                </svg>
                Call
              </button>
              <button className="clear-btn" onClick={()=>conversationId&&deleteConversation(conversationId)}>Clear</button>
            </div>
          </div>

          <div className="chat-area" ref={chatAreaRef}>
            {messages.length === 0
              ? (
                <div className="empty-state">
                  <div className="empty-orb">O</div>
                  <h2>Hey, I'm Orion</h2>
                  <p>Ask me anything, upload a file, or describe an image to generate</p>
                </div>
              )
              : messages.map((msg, i) => <MessageBubble key={i} role={msg.role} content={msg.content} streaming={msg.streaming} />)
            }
          </div>

          <div className="input-area">
            {uploadedFile && (
              <div className="file-chip">
                <span style={{display:'flex',alignItems:'center',color:'#007AFF'}}>
                  {isImageFile ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
                  ) : uploadedFile?.name?.endsWith('.zip') ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/></svg>
                  )}
                </span>
                <span className="file-chip-name">{uploadedFile.name}</span>
                <button className="file-chip-remove" onClick={removeFile}>×</button>
              </div>
            )}
            <div className={`input-box${isStreaming ? " locked" : ""}`}>
              <textarea
                ref={textareaRef}
                className="input-textarea"
                value={input}
                onChange={handleTextareaChange}
                onKeyDown={handleKeyDown}
                placeholder={isStreaming ? "Orion is responding…" : isImageFile && imageUrl ? "Describe how to edit this image…" : "Message Orion…"}
                disabled={isStreaming}
                rows={1}
              />
              <div className="input-actions">
                <input type="file" ref={fileInputRef} style={{display:'none'}} onChange={handleFileChange} accept="image/*,.pdf,.zip,.js,.ts,.jsx,.tsx,.py,.java,.c,.cpp,.cs,.go,.rs,.md,.txt,.html,.css,.json,.yaml,.yml,.sh,.sql,.csv,.env,.toml" />
                <button className="icon-btn" onClick={()=>!isStreaming&&fileInputRef.current?.click()} disabled={isStreaming} title="Attach file">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/>
                  </svg>
                </button>
                {recognitionRef.current && (
                  <button className={`icon-btn${isListening?' listening':''}`} onClick={toggleMic} title="Voice input">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="9" y="2" width="6" height="13" rx="3"/>
                      <path d="M5 10a7 7 0 0014 0"/>
                      <line x1="12" y1="19" x2="12" y2="23"/>
                      <line x1="8" y1="23" x2="16" y2="23"/>
                    </svg>
                  </button>
                )}
                <button className="send-btn" onClick={sendMessage} disabled={isStreaming||!input.trim()}>
                  <svg viewBox="0 0 24 24"><path d="M2 21l21-9L2 3v7l15 2-15 2z"/></svg>
                </button>
              </div>
            </div>
            <div className="status-row">
              <div className={`status-dot${statusLoading?' loading':''}`} />
              <span className="status-text">{status}</span>
            </div>
          </div>
        </div>
          {/* Preview panel mounts here */}
          <div id="orion-preview-root" style={{ width: previewOpen ? 'min(52%, 700px)' : 0, flexShrink: 0, overflow: 'hidden', transition: 'width 0.28s cubic-bezier(0.32,0.72,0,1)', position: 'relative' }} />
        </div>{/* end split row */}
      </div>{/* end chat-app */}
      {callActive && <CallMode user={user} onClose={()=>setCallActive(false)} />}
    </>
  )
}