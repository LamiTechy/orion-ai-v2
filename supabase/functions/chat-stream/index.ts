// supabase/functions/chat-stream/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Groq from 'https://esm.sh/groq-sdk'

const MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct'
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const groq = new Groq({ apiKey: Deno.env.get('GROQ_API_KEY') })

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

function needsRealTimeInfo(message: string) {
  const keywords = ['weather','temperature','today','now','current','latest','recent','news','breaking','price','stock','crypto','score','game','match','sports','trending']
  return keywords.some(k => message.toLowerCase().includes(k))
}

async function searchWeb(query: string) {
  try {
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: Deno.env.get('TAVILY_API_KEY'), query, search_depth: 'basic', include_answer: true, max_results: 5 })
    })
    const data = await res.json()
    return { answer: data.answer || '', results: data.results || [] }
  } catch { return { answer: '', results: [] } }
}

async function getUserMemory(userId: string) {
  const { data } = await supabase.from('user_memory').select('facts').eq('user_id', userId).single()
  if (!data || !data.facts?.length) return ''
  return '\n\n[What you remember about this user]\n' + data.facts.map((f: string) => `- ${f}`).join('\n')
}

async function extractAndSaveMemory(userId: string, conversation: {role:string,content:string}[]) {
  try {
    if (conversation.length < 2) return
    const recent = conversation.slice(-6).map(m => `${m.role}: ${m.content.substring(0, 200)}`).join('\n')
    const res = await groq.chat.completions.create({
      model: MODEL, max_tokens: 150,
      messages: [{ role: 'user', content: `Extract personal facts about the USER ONLY from this conversation. Return JSON array of short fact strings, max 5. If nothing new, return [].\n\nConversation:\n${recent}\n\nReply with JSON array only e.g: ["Name is John", "Works as nurse"]` }]
    })
    const raw = res.choices[0].message.content?.trim().replace(/```json|```/g, '').trim() || '[]'
    const newFacts: string[] = JSON.parse(raw)
    if (!Array.isArray(newFacts) || !newFacts.length) return
    const { data: existing } = await supabase.from('user_memory').select('facts').eq('user_id', userId).single()
    const existingFacts: string[] = existing?.facts || []
    const merged = [...new Set([...existingFacts, ...newFacts])].slice(0, 20)
    await supabase.from('user_memory').upsert({ user_id: userId, facts: merged, updated_at: new Date().toISOString() })
  } catch {}
}

async function generateAITitle(message: string) {
  try {
    const res = await groq.chat.completions.create({
      model: MODEL, max_tokens: 20,
      messages: [{ role: 'user', content: `Generate a short 3-6 word title for a conversation that starts with: "${message.slice(0, 200)}". Only return the title, no quotes, capitalize each word.` }]
    })
    return res.choices[0].message.content?.trim().replace(/^["']|["']$/g, '') || message.slice(0, 40)
  } catch { return message.slice(0, 40) }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  // Auth
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders })
  const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''))
  if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders })

  const { message, conversationId, fileContent, fileName, isImage, imageUrl, userId } = await req.json()
  if (!message) return new Response(JSON.stringify({ error: 'Message required' }), { status: 400, headers: corsHeaders })

  const uid = user.id

  // Get or create conversation
  let convId = conversationId
  let convTitle = 'New Chat'

  if (!convId) {
    convTitle = await generateAITitle(message)
    const { data: conv } = await supabase.from('conversations').insert({ user_id: uid, title: convTitle }).select().single()
    convId = conv.id
  } else {
    const { data: conv } = await supabase.from('conversations').select('title').eq('id', convId).single()
    convTitle = conv?.title || 'Chat'
  }

  // Save user message
  let userContent = message
  if (fileContent && !isImage) userContent = `[File: ${fileName}]\n${fileContent.substring(0, 500)}...\n\n---\n\n${message}`
  else if (isImage && fileContent) userContent = `[Image: ${fileName}]${imageUrl ? `\n![image](${imageUrl})` : ''}\n${fileContent.substring(0, 300)}...\n\n---\n\n${message}`
  await supabase.from('messages').insert({ conversation_id: convId, role: 'user', content: userContent })

  // Load history
  const { data: history } = await supabase.from('messages').select('role, content').eq('conversation_id', convId).order('created_at', { ascending: true })
  const msgs = (history || []).map((m: any) => ({ role: m.role, content: m.content }))

  // Web search
  let searchContext = ''
  let searching = false
  if (needsRealTimeInfo(message)) {
    searching = true
    const sr = await searchWeb(message)
    if (sr.results?.length) {
      searchContext = `\n\n[Web search results for: "${message}"]\n`
      if (sr.answer) searchContext += `Summary: ${sr.answer}\n\n`
      sr.results.forEach((r: any, i: number) => { searchContext += `${i+1}. ${r.title}\n   ${r.content}\n   Source: ${r.url}\n` })
    }
  }

  const userMemory = await getUserMemory(uid)
  const systemPrompt = (Deno.env.get('SYSTEM_PROMPT') || 'You are Orion, a helpful AI assistant. You are multilingual and fluent in ALL languages including Yoruba, Igbo, Hausa, Nigerian Pidgin, French, Arabic, Spanish and more. ALWAYS detect the language the user is writing in and respond ONLY in that same language. NEVER ask the user to translate. Match the user language automatically. When a user uploads a file or image, carefully read and analyze the full content. Use what you remember about the user to personalize responses.') + userMemory + searchContext

  let messageContent = message
  if (fileContent && !isImage) messageContent = `The user uploaded a file named "${fileName}".\n\nFull content:\n${fileContent}\n\n---\n\nUser question: ${message}`
  else if (isImage && fileContent) messageContent = `The user uploaded an image named "${fileName}".\n\nImage analysis:\n${fileContent}\n\n---\n\nUser question: ${message}`

  const messagesForAI = [
    { role: 'system', content: systemPrompt },
    ...msgs.slice(-6),
    { role: 'user', content: messageContent }
  ]

  // Stream response
  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder()
      const send = (data: object) => controller.enqueue(enc.encode(`data: ${JSON.stringify(data)}\n\n`))

      send({ type: 'start', conversationId: convId, title: convTitle })
      if (searching) send({ type: 'searching', query: message })

      let fullResponse = ''
      try {
        const aiStream = await groq.chat.completions.create({ model: MODEL, max_tokens: 2048, stream: true, messages: messagesForAI })
        for await (const chunk of aiStream) {
          const text = chunk.choices[0]?.delta?.content || ''
          if (text) { fullResponse += text; send({ type: 'delta', text }) }
        }
        // Save assistant message
        await supabase.from('messages').insert({ conversation_id: convId, role: 'assistant', content: fullResponse })
        // Background memory extraction
        extractAndSaveMemory(uid, [...msgs, { role: 'assistant', content: fullResponse }]).catch(() => {})
        send({ type: 'done' })
      } catch (err: any) {
        send({ type: 'error', message: err.message })
      }
      controller.close()
    }
  })

  return new Response(stream, {
    headers: { ...corsHeaders, 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive', 'X-Accel-Buffering': 'no' }
  })
})
