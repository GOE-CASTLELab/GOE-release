import { useEffect } from "react";

const NEW_RETURN_AFTER_MS = 30 * 60 * 1000;
const HEARTBEAT_MS = 60 * 1000;

export function useReturnPattern(): void {
  useEffect(() => {
    let sessionId: string | null = null;
    let activeStartedAt = document.visibilityState === "visible" ? Date.now() : null;
    let hiddenAt: number | null = document.visibilityState === "hidden" ? Date.now() : null;
    let stopped = false;
    let starting = false;

    async function startSession() {
      if (stopped || starting || document.visibilityState !== "visible") return;
      starting = true;
      try {
        const response = await fetch("/api/return-pattern/sessions", {
          method: "POST",
          headers: { "content-type": "application/json" },
          credentials: "include",
          body: "{}",
        });
        if (!response.ok || stopped) return;
        const body = await response.json();
        sessionId = typeof body.id === "string" ? body.id : null;
        activeStartedAt = Date.now();
      } catch {
        // A local tracking failure cannot block the owner's GOE.
      } finally {
        starting = false;
      }
    }

    function flush(close = false) {
      if (!sessionId || (activeStartedAt === null && !close)) return;
      const activeSecondsDelta = activeStartedAt === null ? 0 : Math.max(0, Math.min(90, Math.round((Date.now() - activeStartedAt) / 1000)));
      activeStartedAt = close ? null : Date.now();
      void fetch(`/api/return-pattern/sessions/${sessionId}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        keepalive: true,
        body: JSON.stringify({ activeSecondsDelta, close }),
      }).catch(() => undefined);
      if (close) sessionId = null;
    }

    function onVisibilityChange() {
      if (document.visibilityState === "hidden") {
        hiddenAt = Date.now();
        flush(false);
        activeStartedAt = null;
        return;
      }
      const awayFor = hiddenAt === null ? 0 : Date.now() - hiddenAt;
      hiddenAt = null;
      if (!sessionId || awayFor >= NEW_RETURN_AFTER_MS) {
        if (sessionId) flush(true);
        void startSession();
      } else {
        activeStartedAt = Date.now();
      }
    }

    function onPageHide() { flush(true); }

    void startSession();
    const heartbeat = window.setInterval(() => {
      if (document.visibilityState === "visible") flush(false);
    }, HEARTBEAT_MS);
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      stopped = true;
      window.clearInterval(heartbeat);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pagehide", onPageHide);
      flush(true);
    };
  }, []);
}
