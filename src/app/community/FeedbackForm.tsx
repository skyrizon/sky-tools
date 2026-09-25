"use client";

import { useState } from "react";
import { FEEDBACK_LIMITS, FEEDBACK_TYPES, type FeedbackType } from "@/lib/community";

const inputClass =
  "rounded-lg border border-border bg-background-raised px-3 py-2.5 font-normal focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent-soft";

export default function FeedbackForm({ tools }: { tools: { slug: string; name: string }[] }) {
  const [type, setType] = useState<FeedbackType>("bug");
  const [toolSlug, setToolSlug] = useState("");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setPending(true);

    const res = await fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, toolSlug, title, message, email, website }),
    });
    const body = await res.json().catch(() => ({}));
    setPending(false);

    if (!res.ok) {
      setError(body.error ?? "Something went wrong. Please try again.");
      return;
    }

    setSent(true);
    setTitle("");
    setMessage("");
  }

  if (sent) {
    return (
      <div className="mt-6 rounded-lg bg-accent-soft px-4 py-4 text-sm">
        <p className="font-semibold">Thanks, we got it.</p>
        <p className="mt-1 text-muted">
          If you left an email, we may reach out with questions or when it&apos;s fixed.
        </p>
        <button
          type="button"
          onClick={() => setSent(false)}
          className="mt-3 font-semibold text-accent-hover hover:underline"
        >
          Send another
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
      {error && (
        <p className="rounded-lg bg-error-soft px-4 py-3 text-sm font-semibold text-error">{error}</p>
      )}

      <fieldset className="flex flex-col gap-1.5 text-sm font-semibold">
        <legend className="mb-1.5">Type</legend>
        <div className="flex flex-wrap gap-2">
          {FEEDBACK_TYPES.map((option) => (
            <label
              key={option.value}
              className={`cursor-pointer rounded-lg border px-3 py-2 font-medium transition ${
                type === option.value
                  ? "border-accent bg-accent-soft text-accent-hover"
                  : "border-border text-muted hover:text-foreground"
              }`}
            >
              <input
                type="radio"
                name="type"
                value={option.value}
                checked={type === option.value}
                onChange={() => setType(option.value)}
                className="sr-only"
              />
              {option.label}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-sm font-semibold">
          Tool
          <select
            value={toolSlug}
            onChange={(event) => setToolSlug(event.target.value)}
            className={inputClass}
          >
            <option value="">General / whole site</option>
            {tools.map((tool) => (
              <option key={tool.slug} value={tool.slug}>
                {tool.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-semibold">
          <span>
            Email <span className="font-normal text-muted">(optional, for follow-up)</span>
          </span>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            className={inputClass}
          />
        </label>
      </div>

      <label className="flex flex-col gap-1.5 text-sm font-semibold">
        Title
        <input
          type="text"
          required
          maxLength={FEEDBACK_LIMITS.title}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder={type === "bug" ? "PDF conversion fails on large files" : "Add a PDF merge tool"}
          className={inputClass}
        />
      </label>

      <label className="flex flex-col gap-1.5 text-sm font-semibold">
        Details
        <textarea
          required
          minLength={10}
          maxLength={FEEDBACK_LIMITS.message}
          rows={6}
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          className={inputClass}
        />
      </label>

      {/* Honeypot: hidden from people, often filled in by bots. */}
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        value={website}
        onChange={(event) => setWebsite(event.target.value)}
        className="hidden"
      />

      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-lg bg-gradient-to-br from-accent to-accent-2 px-5 py-2.5 font-bold text-white shadow-md shadow-accent/30 hover:brightness-105 disabled:opacity-60"
      >
        {pending ? "Sending…" : "Send feedback"}
      </button>
    </form>
  );
}
