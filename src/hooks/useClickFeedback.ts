import { useCallback, useRef } from "react";
import { safeStorage } from "@/lib/utils";
import { useUI } from "@/contexts/UIContext";

let globalAudioCtx: AudioContext | null = null;

export function useClickFeedback() {
  const isEnabledRef = useRef<boolean>(true);

  /**
   * Attempt to subscribe to UIContext's reactive state.
   * Falls back to localStorage for environments without UIProvider (e.g. unit tests).
   */
  let contextEnabled: boolean | null = null;
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const { clickFeedbackEnabled } = useUI();
    contextEnabled = clickFeedbackEnabled;
  } catch {
    // UIProvider not mounted (unit test environment) — will use localStorage fallback
  }

  // Read setting dynamically, preferring reactive Context over synchronous I/O
  const checkEnabled = useCallback(() => {
    if (contextEnabled !== null) {
      isEnabledRef.current = contextEnabled;
      return contextEnabled;
    }
    // Fallback: direct localStorage read (only in test environments)
    try {
      const stored = safeStorage.local.getItem("resindb-click-feedback");
      if (stored !== null) {
        isEnabledRef.current = stored === "true";
      }
    } catch {
      isEnabledRef.current = true;
    }
    return isEnabledRef.current;
  }, [contextEnabled]);

  const triggerFeedback = useCallback(() => {
    if (!checkEnabled()) return;

    // 1. Tactile Haptic Vibration
    if (typeof window !== "undefined" && window.navigator && typeof window.navigator.vibrate === "function") {
      try {
        window.navigator.vibrate(15);
      } catch {
        // Silently catch security/browser blocks
      }
    }

    // 2. Synthesize High-Fidelity Clean Click Sound via Web Audio API
    if (typeof window === "undefined" || !("AudioContext" in window || "webkitAudioContext" in window)) {
      return;
    }

    try {
      if (!globalAudioCtx) {
        const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        globalAudioCtx = new AudioContextClass();
      }

      const ctx = globalAudioCtx;
      if (ctx.state === "suspended") {
        ctx.resume();
      }

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      // Pure clean high frequency tone (1400Hz)
      osc.frequency.setValueAtTime(1400, ctx.currentTime);
      // Fast exponential pitch decay for an acoustic click sound
      osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.04);

      // Fast volume envelope decay (0.05s) to avoid pops or long rings
      gain.gain.setValueAtTime(0.04, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.04);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.05);
    } catch {
      // Silently catch audio context initialization blocks
    }
  }, [checkEnabled]);

  return { triggerFeedback };
}
