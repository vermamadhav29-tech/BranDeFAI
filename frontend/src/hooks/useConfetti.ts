import { useCallback } from "react";

const BRAND_COLORS = ["#1A7A4A", "#34D399", "#1A2E44", "#FFFFFF"];

export function useConfetti() {
  const fire = useCallback(
    async (opts: { particleCount?: number; spread?: number } = {}) => {
      const confetti = (await import("canvas-confetti")).default;
      confetti({
        particleCount: opts.particleCount ?? 150,
        spread: opts.spread ?? 90,
        origin: { y: 0.55 },
        colors: BRAND_COLORS,
        startVelocity: 38,
        gravity: 1.1,
        ticks: 80,
      });
    },
    []
  );

  return fire;
}
