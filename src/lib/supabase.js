import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Helper: call a Supabase Edge Function and surface real error messages
export async function callEdgeFunction(name, body, options = {}) {
  const session = await supabase.auth.getSession()
  const token = session.data.session?.access_token
  const url = `${supabaseUrl}/functions/v1/${name}`

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      apikey: supabaseAnonKey,
    },
    body: JSON.stringify(body),
    ...options,
  })

  const data = await res.json()

  if (!res.ok) {
    // Throw with the actual error message from the edge function
    throw new Error(data?.error || data?.message || `Edge function "${name}" failed with status ${res.status}`)
  }

  return data
}

// Helper: stream from an Edge Function (returns raw Response)
export async function streamEdgeFunction(name, body) {
  const session = await supabase.auth.getSession()
  const token = session.data.session?.access_token
  const url = `${supabaseUrl}/functions/v1/${name}`
  return fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      apikey: supabaseAnonKey,
    },
    body: JSON.stringify(body),
  })
}