"use client";

import Script from "next/script";

declare global {
  interface Window {
    kofiWidgetOverlay?: { draw: (username: string, options: Record<string, string>) => void };
  }
}

/** Ko-fi's floating "Support me" button, loaded after the page is idle. */
export default function KofiWidget() {
  return (
    <Script
      src="https://storage.ko-fi.com/cdn/scripts/overlay-widget.js"
      strategy="lazyOnload"
      onLoad={() => {
        window.kofiWidgetOverlay?.draw("skyrizon", {
          type: "floating-chat",
          "floating-chat.donateButton.text": "Support me",
          "floating-chat.donateButton.background-color": "#00b9fe",
          "floating-chat.donateButton.text-color": "#fff",
        });
      }}
    />
  );
}
