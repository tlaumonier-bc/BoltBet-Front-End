// store/sessionStore.ts — player identity + auth session for the game.
import { create } from 'zustand';

export type SessionStatus = 'loading' | 'unset' | 'guest' | 'authed';

interface SessionStore {
  status: SessionStatus;
  username: string;      // empty until chosen
  token: string | null;  // opaque server session token (sent as Bearer)
  suggestedName: string; // random default for the username field

  init: () => void;
  setGuest: (username: string, token: string | null) => void;
  setAuthed: (username: string, token: string) => void;
  signOut: () => void;
}

const SESSION_KEY = 'strike_session_v1';
const LEGACY_ID_KEY = 'strike_game_identity'; // pre-auth random guest id

function randomName(): string {
  return 'guest-' + Math.random().toString(36).slice(2, 7);
}

interface Persisted {
  status: SessionStatus;
  username: string;
  token: string | null;
}

function load(): Persisted | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as Persisted) : null;
  } catch {
    return null;
  }
}

function save(s: Persisted): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(s));
  } catch {
    /* private mode */
  }
}

export const useSessionStore = create<SessionStore>((set) => ({
  status: 'loading',
  username: '',
  token: null,
  suggestedName: randomName(),

  init: () => {
    // 1) existing session?
    const saved = load();
    if (saved && saved.username) {
      set({
        status: saved.status === 'authed' ? 'authed' : 'guest',
        username: saved.username,
        token: saved.token ?? null,
      });
      return;
    }
    // 2) fresh visitor — prefill with the legacy guest id if any, else random
    let suggested = randomName();
    try {
      const legacy = localStorage.getItem(LEGACY_ID_KEY);
      if (legacy) suggested = legacy;
    } catch {
      /* ignore */
    }
    set({ status: 'unset', username: '', token: null, suggestedName: suggested });
  },

  setGuest: (username, token) => {
    const next: Persisted = { status: 'guest', username, token: token ?? null };
    save(next);
    set(next);
  },

  setAuthed: (username, token) => {
    const next: Persisted = { status: 'authed', username, token };
    save(next);
    set(next);
  },

  signOut: () => {
    const reset = { status: 'unset' as const, username: '', token: null };
    save(reset);
    set({ ...reset, suggestedName: randomName() });
  },
}));

/** Bearer token for lib/api.ts headers. */
export function sessionToken(): string | null {
  return useSessionStore.getState().token;
}