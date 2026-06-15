'use client'
// lib/useGame.ts — hooks tying the API + play store together.

import { useCallback, useEffect } from 'react'
import { getGameState, placePick, PickError } from '@/lib/api'
import { usePlayStore } from '@/store/playStore'

const IDENTITY_KEY = 'lmb_identity'

/** Assign a persistent guest username on first load (until real auth exists). */
export function useEnsureIdentity() {
  const username = usePlayStore((s) => s.username)
  const setIdentity = usePlayStore((s) => s.setIdentity)
  useEffect(() => {
    if (username) return
    let id = ''
    try {
      id = localStorage.getItem(IDENTITY_KEY) ?? ''
    } catch {
      /* SSR / privacy mode */
    }
    if (!id) {
      id = 'guest-' + Math.random().toString(36).slice(2, 7)
      try {
        localStorage.setItem(IDENTITY_KEY, id)
      } catch {
        /* ignore */
      }
    }
    setIdentity(id)
  }, [username, setIdentity])
}

/** Seed round / intermission / clock on mount; poll as a socket fallback. */
export function useGameStateSync() {
  const syncClock = usePlayStore((s) => s.syncClock)
  const setRound = usePlayStore((s) => s.setRound)
  const setIntermission = usePlayStore((s) => s.setIntermission)
  useEffect(() => {
    let alive = true
    const load = async () => {
      try {
        const st = await getGameState()
        if (!alive) return
        syncClock(st.server_time)
        if (st.active && st.ends_at && st.round_number != null) {
          setRound(st.round_number, st.ends_at, st.duration_seconds ?? 60)
        } else if (st.intermission && st.next_round_at) {
          setIntermission(st.next_round_at)
        }
      } catch {
        /* keep last known state */
      }
    }
    load()
    const t = setInterval(load, 15000)
    return () => {
      alive = false
      clearInterval(t)
    }
  }, [syncClock, setRound, setIntermission])
}

/** Place a pick on a zone. Returns {ok} or {ok:false, error} for UI feedback. */
export function usePlacePick() {
  const username = usePlayStore((s) => s.username)
  const country = usePlayStore((s) => s.country)
  const setLock = usePlayStore((s) => s.setLock)
  const upsertSelf = usePlayStore((s) => s.upsertSelf)
  return useCallback(
    async (zoneId: string): Promise<{ ok: boolean; error?: string }> => {
      try {
        const r = await placePick(zoneId, username || 'anonymous', country)
        setLock(zoneId, r.expires_at)
        upsertSelf(username || 'anonymous', country)
        return { ok: true }
      } catch (e) {
        return { ok: false, error: e instanceof PickError ? e.code : 'failed' }
      }
    },
    [username, country, setLock, upsertSelf],
  )
}
