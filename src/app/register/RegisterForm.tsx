"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Wordmark from "@/components/Wordmark";

export default function RegisterForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setPending(true);

    const res = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const body = await res.json().catch(() => ({}));

    if (!res.ok) {
      setPending(false);
      setError(body.error ?? "Something went wrong. Please try again.");
      return;
    }

    const result = await signIn("credentials", { email, password, redirect: false });
    setPending(false);

    if (result?.error) {
      router.push("/login");
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-md px-6 py-16">
      <div className="mb-8 flex justify-center">
        <Wordmark height={48} />
      </div>
      <div className="rounded-2xl border border-border-soft bg-background-raised p-8 shadow-lg shadow-black/5">
        <h1 className="text-center text-xl font-bold">Create your account</h1>
        <p className="mt-1 text-center text-sm text-muted">Save and revisit your generated QR codes.</p>

        {error && (
          <p className="mt-4 rounded-lg bg-error-soft px-4 py-3 text-sm font-semibold text-error">
            {error}
          </p>
        )}

        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
          <label className="flex flex-col gap-1.5 text-sm font-semibold">
            Email
            <input
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              className="rounded-lg border border-border px-3 py-2.5 font-normal focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent-soft"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-semibold">
            Password
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="new-password"
              className="rounded-lg border border-border px-3 py-2.5 font-normal focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent-soft"
            />
            <span className="font-normal text-xs text-muted">At least 8 characters.</span>
          </label>
          <button
            type="submit"
            disabled={pending}
            className="mt-2 rounded-lg bg-gradient-to-br from-accent to-accent-2 px-4 py-2.5 font-bold text-white shadow-md shadow-accent/30 hover:brightness-105 disabled:opacity-60"
          >
            {pending ? "Creating account…" : "Sign up"}
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-muted">
          Already have an account?{" "}
          <Link href="/login" className="font-semibold text-accent-hover hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
