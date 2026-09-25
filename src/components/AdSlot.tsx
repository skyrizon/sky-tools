"use client";

import { useEffect, useRef } from "react";
import Script from "next/script";
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

  // Reserve the ad's height up front so the page doesn't jump when it loads (CLS).
  return (
    <div className={`min-h-[280px] ${className}`}>
      {/* Loaded only where an ad unit renders; the id makes Next load it once per page. */}
      <Script
        id="adsbygoogle-js"
        async
        src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT_ID}`}
        crossOrigin="anonymous"
        strategy="afterInteractive"
      />
      <ins
        className="adsbygoogle block"
        style={{ display: "block" }}
        data-ad-client={ADSENSE_CLIENT_ID}
        data-ad-slot={slot}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </div>
  );
}
