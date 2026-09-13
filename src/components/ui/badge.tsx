import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-2xs font-medium tracking-wide uppercase",
  {
    variants: {
      tone: {
        default: "bg-elevated text-muted shadow-[var(--shadow-border)]",
        sage: "bg-primary/15 text-primary",
        long: "bg-long/15 text-long",
        short: "bg-short/15 text-short",
        warn: "bg-warn/15 text-warn",
        material: "bg-short/15 text-short",
        watch: "bg-warn/15 text-warn",
        info: "bg-elevated text-muted",
      },
    },
    defaultVariants: { tone: "default" },
  },
);

export function Badge({
  className,
  tone,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}
