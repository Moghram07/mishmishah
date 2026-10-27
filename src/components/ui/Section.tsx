import { cn } from "@/lib/utils/cn";

export function Section({
  id,
  className,
  children,
}: {
  id?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className={cn("scroll-mt-20 py-16 sm:py-20 lg:py-24", className)}
    >
      <div className="container-wide">{children}</div>
    </section>
  );
}
