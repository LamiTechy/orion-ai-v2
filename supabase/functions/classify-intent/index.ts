// supabase/functions/classify-intent/index.ts
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

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return new Response(JSON.stringify({ isImage: false, prompt: null }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''))
  if (!user) return new Response(JSON.stringify({ isImage: false, prompt: null }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  const { message } = await req.json()

  try {
    const response = await groq.chat.completions.create({
      model: MODEL, max_tokens: 60,
      messages: [{ role: 'user', content: `Analyze this message and determine if the user wants to generate/create an image or wants a text response.\n\nMessage: "${message}"\n\nReply with JSON only:\n- If image: {"isImage": true, "prompt": "<description>"}\n- If text: {"isImage": false, "prompt": null}\n\nImage examples: "show me a cat", "paint a sunset", "visualize a forest", "picture of a dog"\nNot image: "what is a cat", "describe a sunset"` }]
    })
    const raw = response.choices[0].message.content?.trim().replace(/```json|```/g, '').trim() || '{}'
    const json = JSON.parse(raw)
    return new Response(JSON.stringify(json), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch {
    const keywordMatch = message.match(/(?:generate|create|make|draw|show|paint|visualize|picture|photo|image)\s+.+/i)
    return new Response(JSON.stringify({ isImage: !!keywordMatch, prompt: message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
