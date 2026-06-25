'use client';
// components/game/GameAccount.tsx — identity onboarding + account chip.
// Shows a username modal on first entry into game mode; afterwards a small chip
// lets a guest link an OAuth account (so points follow them across devices).
import { useEffect, useState } from 'react';
import { useSessionStore } from '@/store/sessionStore';
import {
  GAME_SERVER_ENABLED,
  checkUsername,
  registerUsername,
  oauthStartUrl,
} from '@/lib/api';

const NAME_RE = /^[a-zA-Z0-9_-]{3,20}$/;
type Avail = 'idle' | 'checking' | 'ok' | 'taken' | 'invalid' | 'error';

function OAuthButtons({ linkToken }: { linkToken: string | null }) {
  const disabled = !GAME_SERVER_ENABLED;
  const go = (p: 'google') => {
    window.location.href = oauthStartUrl(p, linkToken);
  };
  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={disabled}
        onClick={() => go('google')}
        className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 py-2.5 text-sm font-semibold text-white/90 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-white text-[10px] font-bold text-slate-800" aria-hidden>
          G
        </span>
        Continue with Google
      </button>
      {disabled && (
        <p className="text-center text-[11px] text-white/40">
          Sign-in unlocks once the game backend is connected.
        </p>
      )}
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


function PickModal() {
  const suggested = useSessionStore((s) => s.suggestedName);
  const setGuest = useSessionStore((s) => s.setGuest);

  const [name, setName] = useState(suggested);
  const [avail, setAvail] = useState<Avail>('idle');
  const [busy, setBusy] = useState(false);
  const valid = NAME_RE.test(name);

  let displayAvail: Avail = avail;
  if (!valid) {
    displayAvail = 'invalid';
  } else if (!GAME_SERVER_ENABLED) {
    displayAvail = 'ok';
  }

  useEffect(() => {
    if (!valid || !GAME_SERVER_ENABLED) return;

    const t = setTimeout(() => {
      // ✅ Moved inside the async callback to satisfy the linter
      setAvail('checking'); 
      checkUsername(name)
        .then((r) => setAvail(r.available ? 'ok' : 'taken'))
        .catch(() => setAvail('error'));
    }, 400);
    
    return () => clearTimeout(t);
  }, [name, valid]);

  const canStart = valid && !busy && displayAvail !== 'taken' && displayAvail !== 'checking';

  const start = async () => {
    if (!canStart) return;
    setBusy(true);
    try {
      if (GAME_SERVER_ENABLED) {
        const s = await registerUsername(name);
        setGuest(s.username, s.token);
      } else {
        setGuest(name, null);
      }
    } catch {
      setAvail('taken');
      setBusy(false);
    }
  };

  return (
    <Overlay>
      <h2 className="font-display text-xl font-bold">Pick a username</h2>
      <p className="mt-1.5 text-sm text-white/55">
        Play instantly as a guest, or sign in to save your points across devices.
      </p>

      <label className="mt-5 block">
        <span className="text-[11px] uppercase tracking-wider text-white/40">Username</span>
        <input
          value={name}
          onChange={(e) => {
            setName(e.target.value.replace(/\s/g, ''));
            // ✅ Instantly clear the old validation result on keystroke
            setAvail('idle'); 
          }}
          onKeyDown={(e) => e.key === 'Enter' && start()}
          autoFocus
          spellCheck={false}
          className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none focus:border-bolt"
          placeholder="your-name"
        />
        <span className="mt-1.5 block h-4">
          <AvailHint avail={displayAvail} />
        </span>
      </label>

      <button
        onClick={start}
        disabled={!canStart}
        className="btn-glow mt-2 w-full cursor-pointer rounded-xl py-3 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-40"
      >
        {busy ? 'Starting…' : 'Start playing'}
      </button>

      <div className="my-4 flex items-center gap-3 text-[11px] uppercase tracking-wider text-white/30">
        <span className="h-px flex-1 bg-white/10" /> or <span className="h-px flex-1 bg-white/10" />
      </div>

      <OAuthButtons linkToken={null} />
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
        You&rsquo;re playing as <span className="font-semibold text-white/85">{username}</span>. Sign in to
        keep your points and play from any device.
      </p>
      <div className="mt-5">
        <OAuthButtons linkToken={token} />
      </div>
    </Overlay>
  );
}

export default function GameAccount() {
  const status = useSessionStore((s) => s.status);
  const username = useSessionStore((s) => s.username);
  const init = useSessionStore((s) => s.init);
  const [linking, setLinking] = useState(false);

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
          <span className="font-semibold text-white/85">{username}</span>
          {status === 'guest' ? (
            <button
              onClick={() => setLinking(true)}
              className="cursor-pointer rounded-full bg-white/8 px-2 py-0.5 text-[11px] font-medium text-white/65 transition hover:bg-white/15 hover:text-white"
            >
              Save progress
            </button>
          ) : (
            <span className="rounded-full bg-emerald-400/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-300">
              Signed in
            </span>
          )}
        </div>
      )}

      {status === 'unset' && <PickModal />}
      {status === 'guest' && linking && <LinkModal onClose={() => setLinking(false)} />}
    </>
  );
}