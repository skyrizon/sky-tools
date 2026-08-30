import Link from "next/link";
import { auth, signOut } from "@/auth";
import Wordmark from "@/components/Wordmark";

export default async function SiteNav() {
  const session = await auth();

  return (
    <header className="sticky top-0 z-10 border-b border-border bg-background-raised/80 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-4">
        <Wordmark />

        <nav className="flex items-center gap-6 text-sm font-medium">
          <Link href="/" className="text-muted hover:text-foreground">
            Tools
          </Link>

          {session?.user ? (
            <>
              <Link href="/dashboard" className="text-muted hover:text-foreground">
                My QR Codes
              </Link>
              <span className="hidden text-muted sm:inline">{session.user.email}</span>
              <form
                action={async () => {
                  "use server";
                  await signOut({ redirectTo: "/" });
                }}
              >
                <button type="submit" className="text-accent-hover hover:underline">
                  Log out
                </button>
              </form>
            </>
          ) : (
            <>
              <Link href="/login" className="text-muted hover:text-foreground">
                Log in
              </Link>
              <Link
                href="/register"
                className="rounded-lg bg-gradient-to-br from-accent to-accent-2 px-4 py-2 font-semibold text-white shadow-sm hover:brightness-105"
              >
                Sign up
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
