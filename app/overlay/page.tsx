"use client";

import Mark from "@/components/Mark";
import { useShow } from "@/components/use-show";

export default function OverlayPage() {
  const { show } = useShow();
  if (!show) return <div className="overlay-root" />;
  return (
    <div className="overlay-root" data-accent={show.settings.accent}>
      <div className={`anchor ${show.settings.position}`}>
        <Mark show={show} />
      </div>
    </div>
  );
}
