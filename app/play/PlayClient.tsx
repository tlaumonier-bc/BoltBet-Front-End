'use client';

import GlobeWrapper from '@/components/Globe/GlobeWrapper';
import GamePanel from '@/components/game/GamePanel';
import Leaderboards from '@/components/game/Leaderboards';
import { usePlacePick } from '@/lib/useGame';

export default function PlayClient() {
  const place = usePlacePick();

  return (
    <main>
      <GlobeWrapper gameMode fill onPickZone={(z) => place(z)} />

      {/* Left column — mirrors LiveHUD's left panel */}
      <div className="mt-4 pointer-events-none fixed bottom-4 left-4 right-4 top-20 z-40 flex flex-col md:right-auto md:w-75">
        <GamePanel />
      </div>

      {/* Right column — mirrors LiveHUD's Pro panel (lg+ only) */}
      <div className="mt-4 pointer-events-none fixed bottom-4 right-4 top-20 z-40 hidden w-[320px] flex-col lg:flex">
        <Leaderboards />
      </div>
    </main>
  );
}