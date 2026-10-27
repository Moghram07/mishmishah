import { cn } from "@/lib/utils/cn";

export function Badge({
  children,
  className,
  tone = "apricot",
}: {
  children: React.ReactNode;
  className?: string;
  tone?: "apricot" | "neutral" | "solid";
}) {
  const tones = {
    apricot:
      "bg-apricot-500/12 text-apricot-700 dark:text-apricot-300 border-apricot-500/20",
    neutral: "bg-muted text-muted-foreground border-border",
    solid: "bg-apricot-500 text-white border-transparent",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold",
        tones[tone],
        className
      )}
    >
      {children}
    </span>
  );
}
