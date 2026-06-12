'use client';

import dynamic from 'next/dynamic';

interface LightningGlobeProps {
  viewOnly?: boolean;
  fill?: boolean;
  enableZoom?: boolean;
  showZoomButtons?: boolean;
}

const LightningGlobe = dynamic<LightningGlobeProps>(
  () => import('./LightningGlobe'),
  {
    ssr: false,
    loading: () => <GlobePlaceholder />,
  }
);

function GlobePlaceholder() {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black">
      <div className="h-64 w-64 animate-pulse rounded-full bg-linear-to-br from-blue-900 via-slate-900 to-black shadow-[0_0_90px_25px_rgba(59,130,246,0.25)]" />
      <span className="absolute bottom-12 text-sm tracking-[0.3em] text-blue-300/60">
        LOADING GLOBE…
      </span>
    </div>
  );
}

export default function GlobeWrapper(props: LightningGlobeProps) {
  return <LightningGlobe {...props} />;
}