import type { ButtonHTMLAttributes } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost";
};

export function Button({ className = "", variant = "primary", ...props }: ButtonProps) {
  const styles = {
    primary: "bg-[#1d1d1f] text-white hover:bg-[#3a3a3c]",
    secondary: "border border-slate-200 bg-white text-slate-800 hover:bg-slate-50",
    ghost: "text-slate-600 hover:bg-slate-100",
  };
  return (
    <button
      className={`inline-flex min-h-11 items-center justify-center rounded-xl px-4 text-sm font-semibold transition-colors ${styles[variant]} ${className}`}
      {...props}
    />
  );
}
