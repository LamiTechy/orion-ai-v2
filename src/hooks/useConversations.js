import { useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export function useConversations(userId) {
  const [conversations, setConversations] = useState([])

  const load = useCallback(async () => {
    if (!userId) return
    const { data } = await supabase
      .from('conversations')
      .select('id, title, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    setConversations(data || [])
  }, [userId])

  const create = useCallback(async (title = 'New Chat') => {
    const { data, error } = await supabase
      .from('conversations')
      .insert({ user_id: userId, title })
      .select()
      .single()
    if (error) throw error
    await load()
    return data
  }, [userId, load])

  const remove = useCallback(async (id) => {
    await supabase.from('messages').delete().eq('conversation_id', id)
    await supabase.from('conversations').delete().eq('id', id)
    setConversations(prev => prev.filter(c => c.id !== id))
  }, [])

  const updateTitle = useCallback(async (id, title) => {
    await supabase.from('conversations').update({ title }).eq('id', id)
    setConversations(prev => prev.map(c => c.id === id ? { ...c, title } : c))
  }, [])

  const getMessages = useCallback(async (id) => {
    const { data } = await supabase
      .from('messages')
      .select('role, content, created_at')
      .eq('conversation_id', id)
      .order('created_at', { ascending: true })
    return data || []
  }, [])

  const saveMessage = useCallback(async (conversationId, role, content) => {
    await supabase.from('messages').insert({ conversation_id: conversationId, role, content })
  }, [])

  return { conversations, load, create, remove, updateTitle, getMessages, saveMessage }
}
