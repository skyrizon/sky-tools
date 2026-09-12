export function ToolInfoSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-10 rounded-2xl border border-border-soft bg-background-raised p-6">
      <h2 className="text-lg font-bold">{title}</h2>
      <div className="mt-3 flex flex-col gap-3 text-sm text-muted [&_p]:leading-relaxed">
        {children}
      </div>
    </section>
  );
}

export function Faq({ items }: { items: { q: string; a: string }[] }) {
  return (
    <dl className="flex flex-col gap-4">
      {items.map((item) => (
        <div key={item.q}>
          <dt className="font-semibold text-foreground">{item.q}</dt>
          <dd className="mt-1 text-sm text-muted">{item.a}</dd>
        </div>
      ))}
    </dl>
  );
}
