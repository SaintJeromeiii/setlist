"use client";

import { useCallback, useEffect, useState } from "react";
import type { PublicShow } from "@/lib/types";

export function useShow() {
  const [show, setShow] = useState<PublicShow | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const tick = () => {
      fetch("/api/show", { cache: "no-store" })
        .then((response) => {
          if (!response.ok) throw new Error("The booth lost its place.");
          return response.json() as Promise<PublicShow>;
        })
        .then((data) => {
          if (alive) setShow(data);
        })
        .catch(() => {
          if (alive) setError("The booth lost its place.");
        });
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, []);

  const send = useCallback(async (body: Record<string, unknown>) => {
    const response = await fetch("/api/show", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await response.json()) as PublicShow & { error?: string };
    if (!response.ok) throw new Error(data.error || "Could not update the set.");
    setShow(data);
    setError(null);
    return data;
  }, []);

  return { show, error, setError, send };
}
