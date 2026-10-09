import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'

interface SessionState {
  session: Session | null
  loading: boolean
}

export function useSession(): SessionState {
  const [state, setState] = useState<SessionState>({ session: null, loading: true })

  useEffect(() => {
    let alive = true
    let unsubscribe: (() => void) | undefined
    void import('./supabase')
      .then(({ supabase }) => {
        if (!alive) return
        supabase()
          .auth.getSession()
          .then(({ data }) => {
            if (alive) setState({ session: data.session, loading: false })
          })
          .catch(() => {
            if (alive) setState({ session: null, loading: false })
          })
        const { data: sub } = supabase().auth.onAuthStateChange((_event, session) => {
          if (alive) setState({ session, loading: false })
        })
        unsubscribe = () => sub.subscription.unsubscribe()
      })
      .catch(() => {
        if (alive) setState({ session: null, loading: false })
      })
    return () => {
      alive = false
      unsubscribe?.()
    }
  }, [])

  return state
}
