"use client";

import Mark from "@/components/Mark";
import { useBoard } from "@/components/use-show";

export default function OverlayPage() {
  const board = useBoard();
  if (!board) return <div className="overlay-root" />;
  const now = board.nowPlaying;
  const next = board.upNext;
  return (
    <div className="overlay-root" data-accent={board.accent} data-skin={board.skin}>
      <div className={`anchor ${board.position}`}>
        <Mark
          show={{
            settings: { showRequester: board.showRequester, showUpNext: board.showUpNext },
            nowPlaying: now
              ? {
                  id: `${now.title}\n${now.artist}`,
                  title: now.title,
                  artist: now.artist,
                  requester: now.requester ?? "",
                  artUrl: now.artUrl,
                }
              : null,
            upNext: next,
            logoUrl: board.logoStamp ? `/api/logo?v=${board.logoStamp}` : null,
          }}
        />
      </div>
    </div>
  );
}
