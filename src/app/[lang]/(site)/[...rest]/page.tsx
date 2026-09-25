import { notFound } from "next/navigation";

/** Any URL that matches no page renders [lang]/not-found.tsx inside the site layout. */
export default function CatchAll() {
  notFound();
}
