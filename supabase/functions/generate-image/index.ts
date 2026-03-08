// supabase/functions/generate-image/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''))
  if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  const { prompt } = await req.json()
  if (!prompt) return new Response(JSON.stringify({ error: 'No prompt' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  const HF_API_KEY = Deno.env.get('HF_API_KEY')
  if (!HF_API_KEY) return new Response(JSON.stringify({ error: 'HF_API_KEY not set' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  const models = [
    'black-forest-labs/FLUX.1-schnell',
    'stabilityai/stable-diffusion-xl-base-1.0',
    'runwayml/stable-diffusion-v1-5',
  ]

  for (const model of models) {
    try {
      const response = await fetch(`https://router.huggingface.co/hf-inference/models/${model}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${HF_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ inputs: prompt }),
        signal: AbortSignal.timeout(90000)
      })
      if (response.ok) {
        const ct = response.headers.get('content-type') || ''
        if (ct.startsWith('image/')) {
          const arrayBuf = await response.arrayBuffer()
          const bytes = new Uint8Array(arrayBuf)
          const base64 = btoa(String.fromCharCode(...bytes))

          // Upload to Supabase Storage
          const filename = `generated-${Date.now()}.jpg`
          const path = `generated/${user.id}/${filename}`
          await supabase.storage.from('orion-uploads').upload(path, bytes, { contentType: 'image/jpeg' })
          const { data: urlData } = supabase.storage.from('orion-uploads').getPublicUrl(path)

          return new Response(JSON.stringify({ success: true, image_data: base64, image_url: urlData.publicUrl }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
      }
      if (response.status !== 503) break
    } catch {}
  }

  return new Response(JSON.stringify({ error: 'Image generation failed. Please try again.' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
})
