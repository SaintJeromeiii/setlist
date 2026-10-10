"use client";

import { useCallback, useEffect, useState } from "react";
import type { Board } from "@/lib/board";
import type { PublicShow } from "@/lib/types";

const KEY = "setlist-booth-key";

export type BoothShow = PublicShow & {
  links: { request: string; overlay: string; phone: string };
  tips: boolean;
  logoStamp: number;
};

export function boothHeaders(json = true): HeadersInit {
  const key = window.localStorage.getItem(KEY) ?? "";
  return {
    ...(json ? { "content-type": "application/json" } : {}),
    ...(key ? { "x-booth-key": key } : {}),
  };
}

export function useShow() {
  const [show, setShow] = useState<BoothShow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [closed, setClosed] = useState(false);

  useEffect(() => {
    let alive = true;
    let timer = 0;

    const tick = () => {
      fetch("/api/show", { cache: "no-store", credentials: "include", headers: boothHeaders() })
        .then(async (response) => {
          if (response.status === 401) throw new Error("locked");
          if (!response.ok) throw new Error("The booth lost its place.");
          return response.json() as Promise<BoothShow>;
        })
        .then((data) => {
          if (alive) setShow(data);
        })
        .catch((reason: unknown) => {
          if (!alive) return;
          if (reason instanceof Error && reason.message === "locked") setClosed(true);
          else setError("The booth lost its place.");
        });
    };

    const open = async () => {
      try {
        const session = await fetch("/api/session", { cache: "no-store", credentials: "include" });
        if (!alive) return;
        if (session.ok) {
          const data = (await session.json()) as { key?: string };
          if (data.key) localStorage.setItem(KEY, data.key);
        }
        const probe = await fetch("/api/show", {
          cache: "no-store",
          credentials: "include",
          headers: boothHeaders(),
        });
        if (!alive) return;
        if (probe.status === 401) {
          setClosed(true);
          return;
        }
        if (!probe.ok) throw new Error("The booth lost its place.");
        setShow((await probe.json()) as BoothShow);
        timer = window.setInterval(tick, 1000);
      } catch {
        if (alive) setError("The booth lost its place.");
      }
    };

    void open();
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, []);

  const send = useCallback(async (body: Record<string, unknown>) => {
    const response = await fetch("/api/show", {
      method: "POST",
      credentials: "include",
      headers: boothHeaders(),
      body: JSON.stringify(body),
    });
    const data = (await response.json()) as BoothShow & { error?: string };
    if (response.status === 401) {
      setClosed(true);
      throw new Error("The booth is locked.");
    }
    if (!response.ok) throw new Error(data.error || "Could not update the set.");
    setShow(data);
    setError(null);
    return data;
  }, []);

  return { show, error, setError, send, closed };
}

export function useBoard() {
  const [board, setBoard] = useState<Board | null>(null);

  useEffect(() => {
    let alive = true;
    const tick = () => {
      fetch("/api/public", { cache: "no-store" })
        .then(async (response) => {
          if (!response.ok) throw new Error("The set didn't load.");
          return response.json() as Promise<Board>;
        })
        .then((data) => {
          if (alive) setBoard(data);
        })
        .catch(() => {
          // Keep the last board the page already showed.
        });
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, []);

  return board;
}
