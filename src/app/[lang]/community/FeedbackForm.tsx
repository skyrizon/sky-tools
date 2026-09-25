"use client";

import { useState } from "react";
import type { Dictionary } from "@/dictionaries";
import type { Locale } from "@/lib/i18n";
import {
  FEEDBACK_LIMITS,
  FEEDBACK_TYPES,
  type FeedbackErrorCode,
  type FeedbackType,
} from "@/lib/community";

const inputClass =
  "rounded-lg border border-border bg-background-raised px-3 py-2.5 font-normal focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent-soft";

export default function FeedbackForm({
  lang,
  t,
  tools,
}: {
  lang: Locale;
  t: Dictionary["community"]["form"];
  tools: { slug: string; name: string }[];
}) {
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
      body: JSON.stringify({ type, toolSlug, title, message, email, website, lang }),
    }).catch(() => null);
    const body: { code?: FeedbackErrorCode } = (await res?.json().catch(() => ({}))) ?? {};
    setPending(false);

    if (!res?.ok) {
      setError(t.errors[body.code ?? "failed"] ?? t.errors.failed);
      return;
    }

    setSent(true);
    setTitle("");
    setMessage("");
  }

  if (sent) {
    return (
      <div className="mt-6 rounded-lg bg-accent-soft px-4 py-4 text-sm">
        <p className="font-semibold">{t.thanks}</p>
        <p className="mt-1 text-muted">{t.thanksBody}</p>
        <button
          type="button"
          onClick={() => setSent(false)}
          className="mt-3 font-semibold text-accent-hover hover:underline"
        >
          {t.sendAnother}
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
        <legend className="mb-1.5">{t.type}</legend>
        <div className="flex flex-wrap gap-2">
          {FEEDBACK_TYPES.map((value) => (
            <label
              key={value}
              className={`cursor-pointer rounded-lg border px-3 py-2 font-medium transition ${
                type === value
                  ? "border-accent bg-accent-soft text-accent-hover"
                  : "border-border text-muted hover:text-foreground"
              }`}
            >
              <input
                type="radio"
                name="type"
                value={value}
                checked={type === value}
                onChange={() => setType(value)}
                className="sr-only"
              />
              {t.types[value]}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-sm font-semibold">
          {t.tool}
          <select
            value={toolSlug}
            onChange={(event) => setToolSlug(event.target.value)}
            className={inputClass}
          >
            <option value="">{t.general}</option>
            {tools.map((tool) => (
              <option key={tool.slug} value={tool.slug}>
                {tool.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-semibold">
          <span>
            {t.email} <span className="font-normal text-muted">{t.emailHint}</span>
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
        {t.title}
        <input
          type="text"
          required
          maxLength={FEEDBACK_LIMITS.title}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder={type === "bug" ? t.titlePlaceholderBug : t.titlePlaceholderIdea}
          className={inputClass}
        />
      </label>

      <label className="flex flex-col gap-1.5 text-sm font-semibold">
        {t.details}
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
        {pending ? t.sending : t.send}
      </button>
    </form>
  );
}
