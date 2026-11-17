import { forwardRef } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils/cn";

type Variant = "primary" | "secondary" | "outline" | "ghost";
type Size = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 rounded-full font-medium btn-focus transition-all duration-200 disabled:opacity-50 disabled:pointer-events-none select-none";

const variants: Record<Variant, string> = {
  primary:
    "bg-apricot-500 text-white shadow-soft hover:bg-apricot-600 hover:shadow-lift active:scale-[0.98]",
  secondary:
    "bg-foreground text-background hover:opacity-90 active:scale-[0.98]",
  outline:
    "border border-border bg-card/60 text-foreground hover:border-apricot-400 hover:bg-card active:scale-[0.98]",
  ghost: "text-foreground hover:bg-muted active:scale-[0.98]",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-4 text-sm",
  md: "h-11 px-6 text-sm",
  lg: "h-[3.25rem] px-8 text-base",
};

interface CommonProps {
  variant?: Variant;
  size?: Size;
  className?: string;
  children: React.ReactNode;
}

type ButtonAsButton = CommonProps &
  React.ButtonHTMLAttributes<HTMLButtonElement> & { href?: undefined };
type ButtonAsLink = CommonProps & {
  href: string;
  /** A link off the site, such as WhatsApp: opened in a new tab. */
  external?: boolean;
};

export const Button = forwardRef<HTMLButtonElement, ButtonAsButton>(
  function Button({ variant = "primary", size = "md", className, ...props }, ref) {
    return (
      <button
        ref={ref}
        className={cn(base, variants[variant], sizes[size], className)}
        {...props}
      />
    );
  }
);

export function ButtonLink({
  variant = "primary",
  size = "md",
  className,
  href,
  external,
  children,
}: ButtonAsLink) {
  if (external || href.startsWith("mailto:")) {
    return (
      <a
        href={href}
        {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
        className={cn(base, variants[variant], sizes[size], className)}
      >
        {children}
      </a>
    );
  }
  return (
    <Link
      href={href}
      className={cn(base, variants[variant], sizes[size], className)}
    >
      {children}
    </Link>
  );
}
