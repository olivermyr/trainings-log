import { useEffect } from 'react';

type Sentinel = { release: () => Promise<void>; addEventListener?: (t: string, f: () => void) => void };

/**
 * Keeps the screen on while `enabled`. iOS releases the lock whenever the app is hidden,
 * so it is re-requested on every return to the foreground.
 */
export function useWakeLock(enabled: boolean) {
  useEffect(() => {
    const wl = (navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<Sentinel> } }).wakeLock;
    if (!enabled || !wl) return;
    let sentinel: Sentinel | null = null;
    let cancelled = false;
    const acquire = async () => {
      if (document.visibilityState !== 'visible' || sentinel) return;
      try {
        const s = await wl.request('screen');
        if (cancelled) return void s.release();
        sentinel = s;
        s.addEventListener?.('release', () => {
          sentinel = null;
        });
      } catch {
        /* denied (e.g. low power mode) – nothing else to do */
      }
    };
    void acquire();
    document.addEventListener('visibilitychange', acquire);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', acquire);
      void sentinel?.release();
      sentinel = null;
    };
  }, [enabled]);
}
