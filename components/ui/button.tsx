import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";
export const buttonVariants = cva(
  "inline-flex items-center justify-center text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-white hover:bg-primary-container",
        outline:
          "border border-outline-variant bg-transparent text-primary hover:bg-surface-container",
        ghost: "text-on-surface hover:bg-surface-container",
        pill: "rounded-full bg-primary text-white tracking-wide hover:bg-primary-container",
        "pill-outline":
          "rounded-full border border-primary text-primary tracking-wide hover:bg-lavender-soft",
        link: "rounded-full text-primary tracking-wide hover:underline",
      },
      size: {
        default: "h-10 px-5",
        sm: "h-8 px-3 text-xs",
        lg: "h-12 px-8",
        "pill-lg": "gap-2.5 px-9 py-4 text-lg font-normal",
        "pill-sm": "gap-2.5 px-[22px] py-2.5 text-sm font-medium",
        "link-sm": "gap-2.5 py-1.5 text-sm font-medium",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);
export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}
export function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}
