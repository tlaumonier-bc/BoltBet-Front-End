'use client';
// components/game/GameAccount.tsx — identity onboarding + account chip.
// Shows a username modal on first entry into game mode; afterwards a small chip
// lets a guest link a Firebase account (so points follow them across devices).
import { useEffect, useState } from 'react';
import { useSessionStore } from '@/store/sessionStore';
import {
  GAME_SERVER_ENABLED,
  changeUsername,
  checkUsername,
  exchangeFirebaseToken,
  registerUsername,
} from '@/lib/api';
import { firebaseAuthConfigured, signInWithGoogle } from '@/lib/firebase';

const NAME_RE = /^[a-zA-Z0-9_-]{3,20}$/;
type Avail = 'idle' | 'checking' | 'ok' | 'taken' | 'invalid' | 'error';

function FirebaseAuthButtons({ linkToken }: { linkToken: string | null }) {
  const setAuthed = useSessionStore((s) => s.setAuthed);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const configured = firebaseAuthConfigured();
  const disabled = !GAME_SERVER_ENABLED || !configured || busy;

  const go = async () => {
    if (disabled) return;
    setBusy(true);
    setError(null);
    try {
      const idToken = await signInWithGoogle();
      const session = await exchangeFirebaseToken(idToken, linkToken);
      setAuthed(session.username, session.token, session);
    } catch {
      setError('Sign-in failed. Please try again.');
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={disabled}
        onClick={go}
        className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 py-2.5 text-sm font-semibold text-white/90 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-white text-[10px] font-bold text-slate-800" aria-hidden>
          G
        </span>
        {busy ? 'Signing in…' : 'Continue with Google'}
      </button>
      {(!GAME_SERVER_ENABLED || !configured) && (
        <p className="text-center text-[11px] text-white/40">
          {configured ? 'Google sign-in unlocks once the game backend is connected.' : 'Firebase config is needed to enable Google sign-in.'}
        </p>
      )}
      {error && <p className="text-center text-[11px] text-rose-300">Google sign-in failed. Please try again.</p>}
    </div>
  );
}

function AvailHint({ avail }: { avail: Avail }) {
  const map: Record<Avail, { text: string; cls: string } | null> = {
    idle: null,
    checking: { text: 'Checking…', cls: 'text-white/40' },
    ok: { text: '✓ available', cls: 'text-emerald-400' },
    taken: { text: '✗ already taken', cls: 'text-rose-400' },
    invalid: { text: '3–20 letters, numbers, - or _', cls: 'text-white/40' },
    error: { text: "couldn't check — try anyway", cls: 'text-white/40' },
  };
  const m = map[avail];
  return <span className={`text-[11px] ${m?.cls ?? ''}`}>{m?.text ?? ''}</span>;
}

function Overlay({ children }: { children: React.ReactNode }) {
  return (
    <div className="pointer-events-auto fixed inset-0 z-80 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="glass w-full max-w-sm rounded-2xl border border-white/10 p-6 shadow-2xl">{children}</div>
    </div>
  );
}


function AutoGuestSetup() {
  const setGuest = useSessionStore((s) => s.setGuest);
  const suggested = useSessionStore((s) => s.suggestedName);
  const [error, setError] = useState(false);

  useEffect(() => {
    let alive = true;
    const setup = async () => {
      try {
        if (GAME_SERVER_ENABLED) {
          const session = await registerUsername();
          if (alive) setGuest(session.username, session.token, session);
        } else if (alive) {
          setGuest(suggested, null, { canChangeUsername: true });
        }
      } catch {
        if (alive) setError(true);
      }
    };
    setup();
    return () => {
      alive = false;
    };
  }, [setGuest, suggested]);

  if (!error) {
    return (
      <div className="pointer-events-auto glass fixed left-1/2 top-24 z-80 w-[min(360px,calc(100vw-2rem))] -translate-x-1/2 rounded-2xl border border-white/10 p-4 text-center shadow-2xl">
        <p className="font-display text-sm font-bold text-white">Preparing your player profile</p>
        <p className="mt-1 text-xs text-white/50">A unique username is being assigned automatically.</p>
      </div>
    );
  }

  return (
    <Overlay>
      <h2 className="font-display text-xl font-bold">Couldn&rsquo;t start the game</h2>
      <p className="mt-1.5 text-sm text-white/55">
        The game backend could not create your player profile. Please try again in a moment.
      </p>
    </Overlay>
  );
}

function RenameModal({ onClose }: { onClose: () => void }) {
  const username = useSessionStore((s) => s.username);
  const canChangeUsername = useSessionStore((s) => s.canChangeUsername);
  const availableAt = useSessionStore((s) => s.usernameChangeAvailableAt);
  const updateAccount = useSessionStore((s) => s.updateAccount);

  const [name, setName] = useState(username);
  const [avail, setAvail] = useState<Avail>('idle');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const valid = NAME_RE.test(name);
  const unchanged = name.toLowerCase() === username.toLowerCase();

  let displayAvail: Avail = avail;
  if (!valid) {
    displayAvail = 'invalid';
  } else if (unchanged) {
    displayAvail = 'ok';
  } else if (!GAME_SERVER_ENABLED) {
    displayAvail = 'ok';
  }

  useEffect(() => {
    if (!valid || unchanged || !GAME_SERVER_ENABLED) return;

    const t = setTimeout(() => {
      setAvail('checking');
      checkUsername(name)
        .then((r) => setAvail(r.available ? 'ok' : 'taken'))
        .catch(() => setAvail('error'));
    }, 400);

    return () => clearTimeout(t);
  }, [name, valid, unchanged]);

  const canSave = canChangeUsername && valid && !busy && !unchanged && displayAvail !== 'taken' && displayAvail !== 'checking';
  const lockDate = availableAt ? new Date(availableAt) : null;

  const save = async () => {
    if (!canSave) return;
    setBusy(true);
    setError(null);
    try {
      const profile = await changeUsername(name);
      updateAccount(profile.username, profile);
      onClose();
    } catch {
      setError('This username is unavailable or your monthly change is still locked.');
      setBusy(false);
    }
  };

  return (
    <Overlay>
      <div className="flex items-start justify-between">
        <h2 className="font-display text-xl font-bold">Change username</h2>
        <button
          onClick={onClose}
          aria-label="Close"
          className="cursor-pointer rounded-lg px-2 py-1 text-white/50 transition hover:bg-white/10 hover:text-white"
        >
          ✕
        </button>
      </div>
      <p className="mt-1.5 text-sm text-white/55">
        Choose carefully. You can change your username once every 30 days.
      </p>

      <label className="mt-5 block">
        <span className="text-[11px] uppercase tracking-wider text-white/40">Username</span>
        <input
          value={name}
          onChange={(e) => {
            setName(e.target.value.replace(/\s/g, ''));
            setAvail('idle');
            setError(null);
          }}
          onKeyDown={(e) => e.key === 'Enter' && save()}
          autoFocus
          spellCheck={false}
          className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none focus:border-bolt"
          placeholder="your-name"
        />
        <span className="mt-1.5 block h-4">
          <AvailHint avail={displayAvail} />
        </span>
      </label>

      {!canChangeUsername && (
        <p className="mb-3 rounded-xl border border-amber-300/20 bg-amber-300/10 px-3 py-2 text-xs text-amber-100/80">
          Username changes unlock again{lockDate ? ` on ${lockDate.toLocaleDateString()}` : ' soon'}.
        </p>
      )}
      {error && <p className="mb-3 text-xs text-rose-300">{error}</p>}

      <button
        onClick={save}
        disabled={!canSave}
        className="btn-glow mt-2 w-full cursor-pointer rounded-xl py-3 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-40"
      >
        {busy ? 'Saving…' : 'Save username'}
      </button>
    </Overlay>
  );
}

function LinkModal({ onClose }: { onClose: () => void }) {
  const token = useSessionStore((s) => s.token);
  const username = useSessionStore((s) => s.username);
  return (
    <Overlay>
      <div className="flex items-start justify-between">
        <h2 className="font-display text-xl font-bold">Save your progress</h2>
        <button
          onClick={onClose}
          aria-label="Close"
          className="cursor-pointer rounded-lg px-2 py-1 text-white/50 transition hover:bg-white/10 hover:text-white"
        >
          ✕
        </button>
      </div>
      <p className="mt-1.5 text-sm text-white/55">
        You&rsquo;re playing as <span className="font-semibold text-white/85">{username}</span>. Sign in with Google
        to keep your points and show as verified on the leaderboard.
      </p>
      <div className="mt-5">
        <FirebaseAuthButtons linkToken={token} />
      </div>
    </Overlay>
  );
}

export default function GameAccount() {
  const status = useSessionStore((s) => s.status);
  const username = useSessionStore((s) => s.username);
  const verified = useSessionStore((s) => s.verified);
  const init = useSessionStore((s) => s.init);
  const [linking, setLinking] = useState(false);
  const [renaming, setRenaming] = useState(false);

  useEffect(() => {
    if (status === 'loading') init();
  }, [status, init]);

  if (status === 'loading') return null;

  return (
    <>
      {/* account chip — flows at the top of the left console column */}
      {status !== 'unset' && (
        <div className="glass pointer-events-auto flex shrink-0 items-center gap-2 self-start rounded-full px-3 py-1.5 text-xs">
          <span className="text-bolt" aria-hidden>⚡</span>
          <button
            type="button"
            onClick={() => setRenaming(true)}
            className="cursor-pointer font-semibold text-white/85 underline-offset-3 transition hover:text-white hover:underline"
            title="Change username"
          >
            {username}
          </button>
          {status === 'guest' ? (
            <button
              onClick={() => setLinking(true)}
              className="cursor-pointer rounded-full bg-white/8 px-2 py-0.5 text-[11px] font-medium text-white/65 transition hover:bg-white/15 hover:text-white"
            >
              Save progress
            </button>
          ) : (
            <span className="rounded-full bg-emerald-400/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-300">
              {verified ? 'Verified' : 'Signed in'}
            </span>
          )}
        </div>
      )}

      {status === 'unset' && <AutoGuestSetup />}
      {status === 'guest' && linking && <LinkModal onClose={() => setLinking(false)} />}
      {(status === 'guest' || status === 'authed') && renaming && <RenameModal onClose={() => setRenaming(false)} />}
    </>
  );
}
