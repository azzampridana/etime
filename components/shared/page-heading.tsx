export function PageHeading({ title, description, eyebrow }: { title: string; description?: string; eyebrow?: string }) {
  return (
    <div className="mb-8 min-w-0">
      {eyebrow && <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-teal-800">{eyebrow}</p>}
      <h1 className="break-words text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
      {description && <p className="mt-2 max-w-2xl break-words text-sm leading-6 text-muted-foreground">{description}</p>}
    </div>
  );
}
