// supabase/functions/save-image-messages/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Groq from 'https://esm.sh/groq-sdk'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const groq = new Groq({ apiKey: Deno.env.get('GROQ_API_KEY') })
const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
const MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct'

async function generateAITitle(message: string) {
  try {
    const res = await groq.chat.completions.create({
      model: MODEL, max_tokens: 20,
      messages: [{ role: 'user', content: `Generate a short 3-6 word title for a conversation that starts with: "${message.slice(0, 200)}". Only the title, no quotes, capitalize each word.` }]
    })
    return res.choices[0].message.content?.trim().replace(/^["']|["']$/g, '') || message.slice(0, 40)
  } catch { return message.slice(0, 40) }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''))
  if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  const { conversationId, userMessage, assistantMessage } = await req.json()

  let convId = conversationId
  let title = 'Image Chat'

  if (!convId) {
    title = await generateAITitle(userMessage)
    const { data: conv } = await supabase.from('conversations').insert({ user_id: user.id, title }).select().single()
    convId = conv.id
  } else {
    const { data: conv } = await supabase.from('conversations').select('title').eq('id', convId).single()
    title = conv?.title || title
  }

  await supabase.from('messages').insert({ conversation_id: convId, role: 'user', content: userMessage })
  await supabase.from('messages').insert({ conversation_id: convId, role: 'assistant', content: assistantMessage })

  return new Response(JSON.stringify({ success: true, conversationId: convId, title }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
})
