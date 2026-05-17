import { cn } from "@/lib/utils";
import { InputHTMLAttributes, forwardRef } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(({ label, error, className, ...props }, ref) => (
  <div className="flex flex-col gap-1">
    {label && <label className="text-sm font-medium text-[#1A2E44]">{label}</label>}
    <input
      ref={ref}
      className={cn(
        "rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none transition-colors",
        "focus:border-[#1A7A4A] focus:ring-2 focus:ring-[#E8F5EE]",
        error && "border-red-400",
        className
      )}
      {...props}
    />
    {error && <span className="text-xs text-red-500">{error}</span>}
  </div>
));
Input.displayName = "Input";

export default Input;
