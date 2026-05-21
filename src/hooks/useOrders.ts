import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Order } from '../lib/types'

export function useOrders() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [newCount, setNewCount] = useState(0)
  const loadedOnce = useRef(false)

  const fetchOrders = useCallback(async () => {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false })
    if (!error && data) setOrders(data as Order[])
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchOrders()
  }, [fetchOrders])

  // Realtime: new orders + external updates
  useEffect(() => {
    const channel = supabase
      .channel('orders-changes')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'orders' },
        (payload) => {
          const row = payload.new as Order
          setOrders((prev) => (prev.some((o) => o.id === row.id) ? prev : [row, ...prev]))
          if (loadedOnce.current) setNewCount((c) => c + 1)
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders' },
        (payload) => {
          const row = payload.new as Order
          setOrders((prev) => {
            const existing = prev.find((o) => o.id === row.id)
            if (!existing) return prev
            // updated_at is bumped by a DB trigger on every real change; equal value
            // means this is an echo of an update we already applied optimistically.
            if (existing.updated_at === row.updated_at) return prev
            return prev.map((o) => (o.id === row.id ? row : o))
          })
        },
      )
      .subscribe()

    loadedOnce.current = true
    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const update = useCallback(async (id: string, patch: Partial<Order>) => {
    const { data, error } = await supabase
      .from('orders')
      .update(patch)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    if (data) setOrders((prev) => prev.map((o) => (o.id === id ? (data as Order) : o)))
    return data as Order
  }, [])

  const resetNewCount = useCallback(() => setNewCount(0), [])

  return { orders, loading, newCount, resetNewCount, update, refetch: fetchOrders }
}
