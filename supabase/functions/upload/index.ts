// supabase/functions/upload/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Groq from 'https://esm.sh/groq-sdk'
import * as pdfjs from 'https://esm.sh/pdfjs-dist@4.4.168/legacy/build/pdf.mjs'

// pdf.js needs a worker — in Deno edge we disable it and run on main thread
pdfjs.GlobalWorkerOptions.workerSrc = ''

async function extractPdfText(bytes: Uint8Array): Promise<string> {
  try {
    const loadingTask = pdfjs.getDocument({ data: bytes, useWorkerFetch: false, isEvalSupported: false, useSystemFonts: true })
    const pdf = await loadingTask.promise
    const numPages = pdf.numPages
    const pageTexts: string[] = []

    for (let i = 1; i <= numPages; i++) {
      const page = await pdf.getPage(i)
      const content = await page.getTextContent()
      const pageText = content.items
        .map((item: any) => ('str' in item ? item.str : ''))
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim()
      if (pageText) pageTexts.push(`[Page ${i}]\n${pageText}`)
    }

    return pageTexts.join('\n\n') || '[PDF has no extractable text — may be a scanned image PDF]'
  } catch (err: any) {
    throw new Error('PDF parse failed: ' + err.message)
  }
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const groq = new Groq({ apiKey: Deno.env.get('GROQ_API_KEY') })
const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''))
  if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  const formData = await req.formData()
  const file = formData.get('file') as File
  if (!file) return new Response(JSON.stringify({ error: 'No file' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  const buffer = await file.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  const ext = file.name.split('.').pop()?.toLowerCase() || ''
  const mime = file.type

  try {
    let text = ''
    let isImage = false
    let imageUrl: string | null = null

    if (mime.startsWith('image/')) {
      isImage = true
      // Upload to Supabase Storage
      const path = `uploads/${user.id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`
      await supabase.storage.from('orion-uploads').upload(path, bytes, { contentType: mime })
      const { data: urlData } = supabase.storage.from('orion-uploads').getPublicUrl(path)
      imageUrl = urlData.publicUrl

      // Vision analysis
      const base64 = btoa(String.fromCharCode(...bytes))
      try {
        const visionRes = await groq.chat.completions.create({
          model: 'meta-llama/llama-4-scout-17b-16e-instruct',
          messages: [{ role: 'user', content: [
            { type: 'image_url', image_url: { url: `data:${mime};base64,${base64}` } },
            { type: 'text', text: 'Describe this image in detail. Include all visible text, objects, people, colors, layout, and any other relevant information.' }
          ]}],
          max_tokens: 1024
        })
        text = `[Image: ${file.name}]\n\nImage description:\n${visionRes.choices[0].message.content}`
      } catch { text = `[Image: ${file.name}]` }

      return new Response(JSON.stringify({
        success: true, filename: file.name, fileType: mime, fileSize: file.size,
        isImage: true, imageUrl, content: text.substring(0, 50000)
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Text/document extraction
    if (mime === 'application/pdf' || ext === 'pdf') {
      text = await extractPdfText(bytes)
    } else if (['js','ts','jsx','tsx','py','java','c','cpp','cs','go','rs','php','rb','swift','kt','md','txt','html','css','sql','sh','json','xml','yaml','yml','env','toml','ini','log','vue','svelte','r','dart','lua','perl','scala','csv'].includes(ext) || mime.startsWith('text/') || mime === 'application/json') {
      text = new TextDecoder('utf-8', { fatal: false }).decode(bytes)
    } else {
      text = `[File: ${file.name} | Type: ${mime} | Size: ${(file.size / 1024).toFixed(1)}KB]`
    }

    return new Response(JSON.stringify({
      success: true, filename: file.name, fileType: mime, fileSize: file.size,
      isImage: false, imageUrl: null, content: text.substring(0, 50000)
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
