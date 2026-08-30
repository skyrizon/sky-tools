import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import DashboardClient from "./DashboardClient";

export const metadata: Metadata = { title: "My QR Codes" };

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login?callbackUrl=/dashboard");
  }

  return <DashboardClient />;
}
