'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { getAdminAccountsGrowth, type AdminAccountsGrowthResponse } from '@/lib/api';
import { firebaseAuthConfigured, signInWithGoogleAccount } from '@/lib/firebase';

function fmt(n: number) {
  return n.toLocaleString();
}

function GrowthChart({ data }: { data: AdminAccountsGrowthResponse }) {
  const points = data.series;
  const chart = useMemo(() => {
    const width = 920;
    const height = 360;
    const pad = { top: 24, right: 28, bottom: 42, left: 54 };
    const innerW = width - pad.left - pad.right;
    const innerH = height - pad.top - pad.bottom;
    const maxNew = Math.max(1, ...points.map((point) => point.newAccounts));
    const maxCum = Math.max(1, ...points.map((point) => point.cumulativeAccounts));
    const x = (index: number) => pad.left + (points.length <= 1 ? innerW : (index / (points.length - 1)) * innerW);
    const yNew = (value: number) => pad.top + innerH - (value / maxNew) * innerH;
    const yCum = (value: number) => pad.top + innerH - (value / maxCum) * innerH;
    const line = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${x(index).toFixed(1)} ${yCum(point.cumulativeAccounts).toFixed(1)}`).join(' ');
    const barW = Math.max(2, Math.min(16, innerW / Math.max(1, points.length) - 2));
    return { width, height, pad, innerH, x, yNew, line, barW, maxNew, maxCum };
  }, [points]);

  if (!points.length) {
    return <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-8 text-center text-white/45">No account data for this period.</div>;
  }

  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-4 shadow-2xl">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 px-1">
        <div>
          <h2 className="font-display text-xl font-black text-white">Game Accounts Growth</h2>
          <p className="mt-1 text-sm text-white/45">Bars are new accounts per day. The blue line is cumulative accounts.</p>
        </div>
        <div className="flex gap-3 text-xs">
          <span className="flex items-center gap-2 text-bolt"><span className="size-2 rounded-sm bg-bolt" /> New/day</span>
          <span className="flex items-center gap-2 text-electric"><span className="h-0.5 w-5 rounded bg-electric" /> Cumulative</span>
        </div>
      </div>
      <svg viewBox={`0 0 ${chart.width} ${chart.height}`} className="h-auto w-full overflow-visible">
        <line x1={chart.pad.left} y1={chart.pad.top + chart.innerH} x2={chart.width - chart.pad.right} y2={chart.pad.top + chart.innerH} stroke="rgba(255,255,255,0.16)" />
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
          const y = chart.pad.top + chart.innerH - ratio * chart.innerH;
          return (
            <g key={ratio}>
              <line x1={chart.pad.left} y1={y} x2={chart.width - chart.pad.right} y2={y} stroke="rgba(255,255,255,0.06)" />
              <text x={chart.pad.left - 10} y={y + 4} textAnchor="end" className="fill-white/35 text-[11px]">
                {Math.round(chart.maxNew * ratio)}
              </text>
            </g>
          );
        })}
        {points.map((point, index) => {
          const x = chart.x(index);
          const y = chart.yNew(point.newAccounts);
          return (
            <rect
              key={point.date}
              x={x - chart.barW / 2}
              y={y}
              width={chart.barW}
              height={chart.pad.top + chart.innerH - y}
              rx="2"
              fill="rgba(250,204,21,0.68)"
            />
          );
        })}
        <path d={chart.line} fill="none" stroke="#38bdf8" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        {points.map((point, index) => index % Math.max(1, Math.floor(points.length / 6)) === 0 ? (
          <text key={point.date} x={chart.x(index)} y={chart.height - 12} textAnchor="middle" className="fill-white/35 text-[11px]">
            {point.date.slice(5)}
          </text>
        ) : null)}
        <text x={chart.width - chart.pad.right} y={chart.pad.top + 12} textAnchor="end" className="fill-electric text-[11px]">
          cumulative max {fmt(chart.maxCum)}
        </text>
      </svg>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.045] p-5">
      <div className="text-[10px] font-bold uppercase tracking-[0.24em] text-white/35">{label}</div>
      <div className="font-display mt-2 text-3xl font-black text-white">{fmt(value)}</div>
    </div>
  );
}

export default function AdminDashboardClient() {
  const [idToken, setIdToken] = useState('');
  const [email, setEmail] = useState('');
  const [data, setData] = useState<AdminAccountsGrowthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = async (token: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await getAdminAccountsGrowth(token, 180);
      setData(result);
    } catch (err) {
      setData(null);
      setError(err instanceof Error ? err.message : 'Admin request failed');
    } finally {
      setLoading(false);
    }
  };

  const signIn = async () => {
    setLoading(true);
    setError(null);
    try {
      const account = await signInWithGoogleAccount();
      setIdToken(account.idToken);
      setEmail(account.email);
      await load(account.idToken);
    } catch {
      setError('Google sign-in failed or this account is not allowed.');
      setLoading(false);
    }
  };

  return (
    <main className="min-h-svh bg-storm px-4 pb-10 pt-24 text-white sm:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-center justify-between gap-4">
          <Link href="/" className="rounded-full border border-white/10 bg-white/6 px-4 py-2 text-sm font-semibold text-white/75 transition hover:bg-white/10 hover:text-white">
            Back to site
          </Link>
          <div className="text-right">
            <div className="text-[10px] font-bold uppercase tracking-[0.28em] text-cyan-100/50">Private</div>
            <h1 className="font-display text-2xl font-black">Admin Dashboard</h1>
          </div>
        </div>

        {!data && (
          <section className="mx-auto max-w-lg rounded-3xl border border-white/10 bg-white/[0.04] p-6 text-center shadow-2xl">
            <h2 className="font-display text-2xl font-black">Sign in required</h2>
            <p className="mt-2 text-sm leading-relaxed text-white/55">
              This page is restricted to admin Google accounts.
            </p>
            <button
              type="button"
              onClick={signIn}
              disabled={loading || !firebaseAuthConfigured()}
              className="btn-glow mt-6 w-full rounded-2xl px-5 py-3 text-sm font-black disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? 'Checking access...' : 'Continue with Google'}
            </button>
            {!firebaseAuthConfigured() && <p className="mt-3 text-xs text-rose-300">Firebase config is missing.</p>}
            {error && <p className="mt-3 text-xs text-rose-300">{error}</p>}
          </section>
        )}

        {data && (
          <section className="space-y-5">
            <div className="rounded-3xl border border-emerald-300/15 bg-emerald-300/10 px-5 py-3 text-sm text-emerald-100/80">
              Signed in as <span className="font-bold">{data.adminEmail || email}</span>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <StatCard label="Total accounts" value={data.totalAccounts} />
              <StatCard label="Guest accounts" value={data.guestAccounts} />
              <StatCard label="Verified accounts" value={data.verifiedAccounts} />
            </div>
            <GrowthChart data={data} />
            <div className="text-right">
              <button
                type="button"
                onClick={() => idToken && load(idToken)}
                disabled={loading}
                className="rounded-full border border-white/10 bg-white/6 px-4 py-2 text-sm font-semibold text-white/75 transition hover:bg-white/10 hover:text-white disabled:opacity-50"
              >
                {loading ? 'Refreshing...' : 'Refresh'}
              </button>
            </div>
            {error && <p className="text-sm text-rose-300">{error}</p>}
          </section>
        )}
      </div>
    </main>
  );
}
