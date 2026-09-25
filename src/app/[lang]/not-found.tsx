import Link from "next/link";
import { lang as rootLang } from "next/root-params";
import { getDictionary } from "@/dictionaries";
import { DEFAULT_LOCALE, hasLocale, localePath } from "@/lib/i18n";

export default async function NotFound() {
  const value = await rootLang();
  const lang = value && hasLocale(value) ? value : DEFAULT_LOCALE;
  const t = getDictionary(lang).notFound;

  return (
    <div className="mx-auto flex max-w-xl flex-col items-center px-6 py-24 text-center">
      <p className="text-sm font-bold text-accent-hover">404</p>
      <h1 className="mt-2 text-3xl font-extrabold tracking-tight">{t.title}</h1>
      <p className="mt-3 text-muted">{t.body}</p>
      <Link
        href={localePath(lang, "/")}
        className="mt-8 rounded-lg bg-gradient-to-br from-accent to-accent-2 px-5 py-2.5 font-bold text-white shadow-md shadow-accent/30 hover:brightness-105"
      >
        {t.home}
      </Link>
    </div>
  );
}
