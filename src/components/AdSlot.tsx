"use client";

import { useEffect, useRef } from "react";
import { ADSENSE_CLIENT_ID } from "@/lib/ads";

declare global {
  interface Window {
    adsbygoogle: unknown[];
  }
}

const PLACEHOLDER_SLOT = "0000000000";

export default function AdSlot({ slot, className = "" }: { slot: string; className?: string }) {
  const pushed = useRef(false);

  useEffect(() => {
    if (slot === PLACEHOLDER_SLOT || pushed.current) return;
    pushed.current = true;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      // AdSense script not loaded yet or blocked (ad blocker) — fail silently.
    }
  }, [slot]);

  // No real ad unit created yet for this placement — render nothing rather than a broken/erroring unit.
  if (slot === PLACEHOLDER_SLOT) return null;

  return (
    <ins
      className={`adsbygoogle block ${className}`}
      style={{ display: "block" }}
      data-ad-client={ADSENSE_CLIENT_ID}
      data-ad-slot={slot}
      data-ad-format="auto"
      data-full-width-responsive="true"
    />
  );
}
