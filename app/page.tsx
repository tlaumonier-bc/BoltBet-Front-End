// Control-room / terminal landing. Server-rendered (crawlable): all copy is
// plain HTML. Positioning: bet on WHERE lightning strikes — 162 live zones,
// real-time multipliers, instant payouts.

import Link from 'next/link';
import { Syncopate, IBM_Plex_Mono } from 'next/font/google';
import HeroLiveGlobe from '@/components/Hero/HeroLiveGlobe';
import StrikesToday from '@/components/Hero/StrikesToday';
import { pages, launchablePages } from '@/lib/content/content';

const display = Syncopate({ weight: ['400', '700'], subsets: ['latin'], variable: '--lp-display' });
const mono = IBM_Plex_Mono({
  weight: ['400', '500', '600'],
  subsets: ['latin'],
  variable: '--lp-mono',
});

const live = launchablePages();
const POPULAR = (live.length ? live : pages).slice(0, 8);

const FEATURES = [
  {
    icon: '◎',
    tag: 'WATCH',
    body: 'A live global map of lightning, streamed from the Blitzortung detection network. Storms move in real time across 162 zones.',
  },
  {
    icon: '⌖',
    tag: 'TAKE A POSITION',
    body: 'Every zone carries a live multiplier — calm zones pay more, active storms pay less. Pick where the next bolt lands.',
  },
  {
    icon: '⚡',
    tag: 'CASH THE STRIKE',
    body: 'If lightning hits your zone inside the window, the multiplier pays out. Miss, and the stake burns. Paper credits — no real money.',
  },
];

const STATS: [string, string, string][] = [
  ['162', 'live zones', 'cyan'],
  ['~60/min', 'strikes detected', 'amber'],
  ['9.0×', 'top payout', 'green'],
  ['real-time', 'settlement', 'plasma'],
];

export default function HomePage() {
  return (
    <main className={`lp ${display.variable} ${mono.variable}`}>
      <style>{`
        .lp{--amber:#ffb000;--cyan:#22d3ff;--plasma:#b98cff;--green:#19f0a0;
          --ink:#e3ecf5;--ink-dim:#7d93a8;--edge:rgba(34,211,255,.22);--panel:rgba(10,16,24,.66);
          --d:var(--lp-display),sans-serif;--m:var(--lp-mono),monospace;
          background:#000;color:var(--ink);
          font-family:var(--m);min-height:100vh}
        .lp a{text-decoration:none}
        .lp .wrap{max-width:1160px;margin:0 auto;padding:0 28px}
        /* topbar */
        .lp .top{display:flex;align-items:center;gap:24px;height:62px;border-bottom:1px solid var(--edge)}
        .lp .brand{font-family:var(--d);font-weight:700;letter-spacing:3px;font-size:15px;color:#fff}
        .lp .brand b{color:var(--amber)}
        .lp .top nav{margin-left:auto;display:flex;gap:4px;align-items:center}
        .lp .top nav a{font-size:11px;font-weight:600;letter-spacing:.16em;text-transform:uppercase;color:var(--ink-dim);padding:8px 12px;border-radius:8px}
        .lp .top nav a:hover{color:#fff;background:rgba(255,255,255,.05)}
        .lp .play{background:linear-gradient(135deg,var(--amber),#ff7a18);color:#1a0e00 !important;font-family:var(--d);font-weight:700;font-size:11px;letter-spacing:.1em;padding:10px 18px;border-radius:9px;box-shadow:0 0 0 1px rgba(255,176,0,.4),0 8px 24px -6px rgba(255,158,27,.6)}
        /* hero — full-bleed globe background */
        .lp .hero{position:relative;overflow:hidden;border-bottom:1px solid var(--edge);min-height:min(88vh,760px);background:#000}
        /* globe lives on the RIGHT, smaller */
        .lp .hero-globe{position:absolute;top:0;bottom:0;right:0;width:56%;z-index:0}
        .lp .hero-globe>div{width:100%;height:100%}
        /* blend the globe's left edge + bottom into pure black */
        .lp .hero-fade{position:absolute;inset:0;z-index:1;pointer-events:none;
          background:
            linear-gradient(90deg,#000 40%,rgba(0,0,0,.55) 52%,transparent 66%),
            linear-gradient(0deg,#000 0%,transparent 24%)}
        .lp .grid-fade{position:absolute;inset:0;z-index:1;pointer-events:none;
          background-image:linear-gradient(rgba(34,211,255,.05) 1px,transparent 1px),linear-gradient(90deg,rgba(34,211,255,.05) 1px,transparent 1px);
          background-size:52px 52px;mask-image:radial-gradient(ellipse at 25% 45%,#000,transparent 65%);-webkit-mask-image:radial-gradient(ellipse at 25% 45%,#000,transparent 65%)}
        .lp .hero-inner{position:relative;z-index:2;display:flex;align-items:center;min-height:min(92vh,820px);pointer-events:none}
        .lp .hero-left{max-width:560px;padding:40px 0}
        .lp .hero-left .kick,.lp .hero-left .btn{pointer-events:auto}
        .lp .counter{margin-top:34px}
        .lp .c-num{display:flex;align-items:center;gap:11px;font-family:var(--d);font-weight:700;font-size:clamp(28px,3.2vw,44px);color:#fff;letter-spacing:.5px;font-variant-numeric:tabular-nums;text-shadow:0 0 24px rgba(34,211,255,.18)}
        .lp .c-num .dot{width:9px;height:9px;border-radius:50%;background:var(--green);box-shadow:0 0 11px var(--green);animation:lpp 1.6s infinite}
        .lp .c-label{margin-top:7px;font-size:10px;font-weight:600;letter-spacing:.2em;text-transform:uppercase;color:var(--ink-dim)}
        .lp .drag-hint{margin-top:22px;font-size:10px;font-weight:600;letter-spacing:.18em;text-transform:uppercase;color:var(--ink-dim)}
        .lp .kick{display:inline-flex;align-items:center;gap:9px;font-size:10.5px;font-weight:600;letter-spacing:.24em;text-transform:uppercase;
          color:var(--amber);border:1px solid rgba(255,176,0,.4);border-radius:100px;padding:8px 16px;margin-bottom:28px}
        .lp .kick i{width:8px;height:8px;border-radius:50%;background:var(--green);box-shadow:0 0 10px var(--green);animation:lpp 1.6s infinite}
        @keyframes lpp{0%,100%{opacity:1}50%{opacity:.25}}
        .lp h1{font-family:var(--d);font-weight:700;font-size:clamp(34px,4.4vw,62px);line-height:1.04;letter-spacing:-.005em;color:#fff;max-width:13ch;
          text-shadow:0 2px 30px rgba(0,0,0,.6)}
        .lp h1 b{font-weight:700;background:linear-gradient(110deg,var(--amber),var(--cyan));-webkit-background-clip:text;background-clip:text;color:transparent;
          filter:drop-shadow(0 0 18px rgba(34,211,255,.25))}
        .lp .sub{max-width:48ch;margin-top:24px;font-size:15.5px;font-weight:500;line-height:1.7;color:#b7c6d6}
        .lp .ctas{display:flex;flex-wrap:wrap;gap:12px;margin-top:36px}
        .lp .btn{display:inline-flex;align-items:center;gap:9px;font-family:var(--d);font-weight:700;font-size:12px;letter-spacing:.14em;text-transform:uppercase;padding:16px 28px;border-radius:12px;transition:.18s;border:1px solid transparent}
        .lp .btn.primary{background:linear-gradient(135deg,var(--amber),#ff7a18);color:#1a0e00;box-shadow:0 0 0 1px rgba(255,176,0,.4),0 12px 34px -8px rgba(255,158,27,.5)}
        .lp .btn.primary:hover{transform:translateY(-2px);box-shadow:0 0 0 1px rgba(255,176,0,.6),0 18px 44px -8px rgba(255,158,27,.65)}
        .lp .btn.ghost{border-color:var(--edge);color:#fff;background:rgba(255,255,255,.02)}
        .lp .btn.ghost:hover{border-color:var(--cyan);color:var(--cyan)}
        /* statband */
        .lp .statband{display:grid;grid-template-columns:repeat(4,1fr);gap:1px;background:var(--edge);border-bottom:1px solid var(--edge)}
        .lp .cell{background:#06090f;padding:28px 18px;text-align:center}
        .lp .cell .n{font-family:var(--d);font-weight:700;font-size:clamp(22px,2.8vw,32px);letter-spacing:.5px}
        .lp .cell .n.cyan{color:var(--cyan)}.lp .cell .n.amber{color:var(--amber)}.lp .cell .n.green{color:var(--green)}.lp .cell .n.plasma{color:var(--plasma)}
        .lp .cell .l{font-size:9px;letter-spacing:.18em;text-transform:uppercase;color:var(--ink-dim);margin-top:8px}
        /* features */
        .lp .feat-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;padding:64px 0}
        .lp .feat{background:var(--panel);border:1px solid var(--edge);border-radius:14px;padding:24px;transition:.2s}
        .lp .feat:hover{transform:translateY(-3px);border-color:rgba(31,211,255,.34)}
        .lp .feat .ic{width:40px;height:40px;border-radius:11px;display:grid;place-items:center;font-size:18px;margin-bottom:16px;background:rgba(255,176,0,.08);border:1px solid rgba(255,176,0,.22);color:var(--amber)}
        .lp .feat:nth-child(2) .ic{background:rgba(31,211,255,.08);border-color:rgba(31,211,255,.24);color:var(--cyan)}
        .lp .feat:nth-child(3) .ic{background:rgba(185,140,255,.08);border-color:rgba(185,140,255,.26);color:var(--plasma)}
        .lp .feat h3{font-family:var(--d);font-size:11px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;margin-bottom:10px;color:#dfe8f1}
        .lp .feat p{font-size:12.5px;line-height:1.7;color:#93a6bd}
        /* country grid */
        .lp .sec-h{font-family:var(--d);font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:var(--ink-dim);margin-bottom:14px}
        .lp .countries{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;padding-bottom:8px}
        @media(min-width:640px){.lp .countries{grid-template-columns:repeat(4,1fr)}}
        .lp .country{background:var(--panel);border:1px solid var(--edge);border-radius:10px;padding:11px 13px;font-size:12px;transition:.15s}
        .lp .country:hover{border-color:rgba(31,211,255,.34)}
        .lp .country .c{color:var(--ink)}.lp .country .k{color:var(--ink-dim);margin-left:6px;font-size:10px}
        /* cta band */
        .lp .cta-band{margin:60px 0;border:1px solid var(--edge);border-radius:16px;padding:48px 28px;text-align:center;
          background:linear-gradient(135deg,rgba(255,176,0,.06),rgba(185,140,255,.05) 60%,transparent)}
        .lp .cta-band h2{font-family:var(--d);font-weight:700;font-size:clamp(18px,2.6vw,26px);margin-bottom:10px;color:#eaf1f8}
        .lp .cta-band p{font-size:12.5px;color:#93a6bd;margin-bottom:24px}
        /* foot */
        .lp .foot{border-top:1px solid var(--edge);padding:24px 0 48px;font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:var(--ink-dim);display:flex;justify-content:space-between;gap:14px;flex-wrap:wrap}
        @media(max-width:860px){
          .lp .hero-globe{width:100%;opacity:.5}
          .lp .hero-fade{background:linear-gradient(0deg,#000 6%,rgba(0,0,0,.5) 60%,rgba(0,0,0,.2))}
          .lp .hero-left{max-width:none}
          .lp .feat-grid{grid-template-columns:1fr}
          .lp .statband{grid-template-columns:repeat(2,1fr)}
          .lp .top nav a:not(.play){display:none}
        }
      `}</style>

      {/* topbar */}
      <div className="wrap">
        <div className="top">
          <span className="brand">
            LIGHTNING<b>MAP</b>BETS
          </span>
          <nav>
            <Link href="/live">Live map</Link>
            <Link href="/how-it-works">How it works</Link>
            <Link href="/leaderboard">Leaderboard</Link>
            <Link href="/play" className="play">
              Open terminal
            </Link>
          </nav>
        </div>
      </div>

      {/* hero — full-bleed live globe background, copy overlaid */}
      <section className="hero">
        <div className="hero-globe">
          <HeroLiveGlobe />
        </div>
        <div className="hero-fade" />
        <div className="grid-fade" />
        <div className="wrap hero-inner">
          <div className="hero-left">
            <span className="kick">
              <i />
              Live planetary strike feed
            </span>
            <h1>
              Bet on where <b>lightning</b> strikes.
            </h1>
            <p className="sub">
              The whole planet, live. 162 zones, each priced with a real-time multiplier. Pick a
              zone, take a position, and if a bolt lands there you cash the payout. Built on the
              Blitzortung network. Paper credits, no real money.
            </p>
            <div className="ctas">
              <Link href="/play" className="btn primary">
                ⌖ Open the terminal
              </Link>
              <Link href="/live" className="btn ghost">
                Watch the live map
              </Link>
            </div>
            <StrikesToday />
            <div className="drag-hint">drag the globe ·  live strikes in real time</div>
          </div>
        </div>
      </section>

      {/* stats */}
      <div className="statband">
        {STATS.map(([n, l, c]) => (
          <div className="cell" key={l}>
            <div className={`n ${c}`}>{n}</div>
            <div className="l">{l}</div>
          </div>
        ))}
      </div>

      {/* how it works */}
      <div className="wrap">
        <div className="feat-grid" id="how">
          {FEATURES.map((f) => (
            <div className="feat" key={f.tag}>
              <div className="ic">{f.icon}</div>
              <h3>{f.tag}</h3>
              <p>{f.body}</p>
            </div>
          ))}
        </div>

        {/* country maps (SEO) */}
        <section>
          <div className="sec-h">Lightning maps by country</div>
          <div className="countries">
            {POPULAR.map((p) => (
              <Link href={p.slug} key={p.slug} className="country">
                <span className="c">{p.country}</span>
                <span className="k">{p.primaryKeyword}</span>
              </Link>
            ))}
          </div>
        </section>

        {/* cta */}
        <section className="cta-band">
          <h2>The sky is already moving.</h2>
          <p>Free to play · paper credits · real-time global strike data</p>
          <Link href="/play" className="btn primary">
            Take a position →
          </Link>
        </section>

        <div className="foot">
          <span>© LightningMapBets</span>
          <span>Data: Blitzortung.org community network</span>
        </div>
      </div>
    </main>
  );
}
