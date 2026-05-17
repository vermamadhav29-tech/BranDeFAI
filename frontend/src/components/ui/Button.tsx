import { cn } from "@/lib/utils";
import { ButtonHTMLAttributes } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
}

export default function Button({ variant = "primary", size = "md", className, children, ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-lg font-medium transition-colors disabled:opacity-50",
        {
          "bg-[#1A7A4A] text-white hover:bg-[#145C38]": variant === "primary",
          "bg-[#E8F5EE] text-[#1A7A4A] hover:bg-[#d4eddf]": variant === "secondary",
          "bg-transparent text-gray-600 hover:bg-gray-100": variant === "ghost",
          "bg-red-600 text-white hover:bg-red-700": variant === "danger",
          "text-xs px-3 py-1.5": size === "sm",
          "text-sm px-4 py-2": size === "md",
          "text-base px-6 py-3": size === "lg",
        },
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
