import { ButtonHTMLAttributes, forwardRef } from "react";

type Variant = "primary" | "secondary" | "danger" | "ghost";

const VARIANT_CLASSES: Record<Variant, string> = {
  primary: "bg-zinc-900 text-white hover:bg-zinc-700 disabled:bg-zinc-400",
  secondary: "bg-white text-zinc-900 border border-zinc-300 hover:bg-zinc-50 disabled:opacity-50",
  danger: "bg-red-600 text-white hover:bg-red-500 disabled:bg-red-300",
  ghost: "bg-transparent text-zinc-600 hover:bg-zinc-100 disabled:opacity-50",
};

export const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }
>(({ variant = "primary", className = "", ...props }, ref) => (
  <button
    ref={ref}
    className={`inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed ${VARIANT_CLASSES[variant]} ${className}`}
    {...props}
  />
));
Button.displayName = "Button";
