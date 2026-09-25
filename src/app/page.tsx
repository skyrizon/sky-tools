import Link from "next/link";
import { TOOLS } from "@/lib/tools";
import AdSlot from "@/components/AdSlot";
import { AD_SLOTS } from "@/lib/ads";
import { ToolInfoSection } from "@/components/ToolInfo";

export default function Home() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-16">
      <div className="max-w-2xl">
        <h1 className="text-3xl font-extrabold tracking-tight">
          Free tools, no sign-up required.
        </h1>
        <p className="mt-3 text-lg text-muted">
          A growing collection of small, focused web tools that run right in your browser.
        </p>
      </div>

      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {TOOLS.map((tool) => (
          <Link
            key={tool.slug}
            href={`/tools/${tool.slug}`}
            className="group flex flex-col gap-3 rounded-2xl border border-border-soft bg-background-raised p-6 transition hover:border-accent hover:shadow-md hover:shadow-accent/10"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent-soft text-accent-hover">
              <tool.icon className="h-6 w-6" strokeWidth={1.75} />
            </span>
            <span className="font-bold group-hover:text-accent-hover">{tool.name}</span>
            <span className="text-sm text-muted">{tool.description}</span>
          </Link>
        ))}
      </div>

      <ToolInfoSection title="About Sky Tools">
        <p>
          Sky Tools is a small collection of single-purpose web tools that run entirely in your
          browser — a QR code generator, an image and PDF converter, and more added over time. No
          file or piece of data you type into a tool is ever uploaded to a server. That's a
          deliberate choice: most everyday conversions and generations don't need a round trip to
          the cloud, so they don't get one here.
        </p>
        <p>
          Every tool is free, with no sign-up and no account — just open a tool and use it.
        </p>
      </ToolInfoSection>

      <AdSlot slot={AD_SLOTS.homepageBottom} className="mt-10" />
    </div>
  );
}
