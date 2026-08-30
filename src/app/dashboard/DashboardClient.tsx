"use client";

import { useEffect, useState } from "react";
import Wordmark from "@/components/Wordmark";

type HistoryItem = {
  id: string;
  dataText: string;
  size: number;
  errorCorrection: string;
  createdAt: string;
  pngDataUri: string;
};

type HistoryResponse = {
  items: HistoryItem[];
  total: number;
  page: number;
  totalPages: number;
  error?: string;
};

export default function DashboardClient() {
  const [data, setData] = useState<HistoryResponse | null>(null);
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load(targetPage: number) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/history?page=${targetPage}`);
      const body: HistoryResponse = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Could not load your history.");
      setData(body);
      setPage(body.page);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load your history.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(1);
  }, []);

  async function handleDelete(id: string) {
    await fetch(`/api/history?id=${id}`, { method: "DELETE" });
    load(page);
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <div className="mb-8 flex justify-center">
        <Wordmark height={48} />
      </div>
      <h1 className="text-2xl font-bold">My QR Codes</h1>
      <p className="mt-1 text-muted">Everything you&apos;ve saved from the QR generator.</p>

      {error && (
        <p className="mt-6 rounded-lg bg-error-soft px-4 py-3 text-sm font-semibold text-error">
          {error}
        </p>
      )}

      {loading && !data && <p className="mt-8 text-sm text-muted">Loading…</p>}

      {data && data.items.length === 0 && !loading && (
        <p className="mt-8 text-sm text-muted">
          Nothing saved yet — generate a QR code and choose &ldquo;Save to my history&rdquo;.
        </p>
      )}

      {data && data.items.length > 0 && (
        <>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.items.map((item) => (
              <div
                key={item.id}
                className="flex flex-col gap-3 rounded-2xl border border-border-soft bg-background-raised p-4"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.pngDataUri}
                  alt="Saved QR code"
                  className="mx-auto h-40 w-40 rounded-lg border border-border object-contain"
                />
                <p className="line-clamp-2 break-all text-xs text-muted">{item.dataText}</p>
                <div className="flex items-center justify-between">
                  <a
                    href={item.pngDataUri}
                    download="qrcode.png"
                    className="text-xs font-semibold text-accent-hover hover:underline"
                  >
                    Download
                  </a>
                  <button
                    type="button"
                    onClick={() => handleDelete(item.id)}
                    className="text-xs font-semibold text-error hover:underline"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>

          {data.totalPages > 1 && (
            <div className="mt-8 flex items-center justify-center gap-3 text-sm">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => load(page - 1)}
                className="rounded-lg border border-border px-3 py-1.5 font-semibold disabled:opacity-40"
              >
                Previous
              </button>
              <span className="text-muted">
                Page {data.page} of {data.totalPages}
              </span>
              <button
                type="button"
                disabled={page >= data.totalPages}
                onClick={() => load(page + 1)}
                className="rounded-lg border border-border px-3 py-1.5 font-semibold disabled:opacity-40"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
