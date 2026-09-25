export type QrType = "text" | "wifi";

export type QrTemplateInput = {
  type: QrType;
  data: string;
  wifiSsid: string;
  wifiPassword: string;
  wifiEncryption: "WPA" | "WEP" | "nopass";
  wifiHidden: boolean;
};

export type QrTemplateErrorCode = "wifiSsid" | "empty" | "tooLong";

/** Invalid input; `code` lets the UI show the message in the visitor's language. */
export class QrTemplateError extends Error {
  constructor(
    public readonly code: QrTemplateErrorCode,
    message: string,
  ) {
    super(message);
  }
}

function escapeWifiField(value: string): string {
  return value.replace(/([\\;,:"])/g, "\\$1");
}

/**
 * Turns the quick-template sub-fields into the correctly formatted string for
 * the WiFi QR convention, or returns the raw text/URL input as-is.
 * Mirrors the same conventions used by the QRForge WordPress plugin.
 */
export function resolveQrData(input: QrTemplateInput): string {
  switch (input.type) {
    case "wifi": {
      if (input.wifiSsid.trim() === "") {
        throw new QrTemplateError("wifiSsid", "Please enter the WiFi network name (SSID).");
      }
      return `WIFI:T:${input.wifiEncryption};S:${escapeWifiField(input.wifiSsid)};P:${escapeWifiField(
        input.wifiPassword,
      )};H:${input.wifiHidden ? "true" : "false"};;`;
    }

    default: {
      const trimmed = input.data.trim();
      if (trimmed === "") {
        throw new QrTemplateError("empty", "Please enter some text or a URL to encode.");
      }
      if (trimmed.length > 2000) {
        throw new QrTemplateError("tooLong", "Input is too long (maximum 2000 characters).");
      }
      return trimmed;
    }
  }
}
