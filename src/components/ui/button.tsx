import { ButtonHTMLAttributes, forwardRef } from "react";

/** Small shadcn-style button primitive used by the local-first UI. */
export const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement>>(({ className = "", ...props }, ref) => (
  <button ref={ref} className={className} {...props} />
));

Button.displayName = "Button";
