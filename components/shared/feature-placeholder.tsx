import { Construction } from "lucide-react";
import { PageHeading } from "@/components/shared/page-heading";

export function FeaturePlaceholder({ title, description }: { title: string; description: string }) {
  return (
    <>
      <PageHeading title={title} />
      <section className="rounded-lg border border-dashed bg-background px-6 py-12 text-center sm:py-16">
        <Construction aria-hidden="true" className="mx-auto mb-5 size-7 text-muted-foreground" />
        <h2 className="text-base font-semibold">Coming soon</h2>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted-foreground">{description}</p>
      </section>
    </>
  );
}
