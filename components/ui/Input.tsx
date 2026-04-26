import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, className, id, ...rest },
  ref,
) {
  const inputId = id ?? rest.name;
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={inputId} className="text-xs font-medium text-text-secondary">
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={inputId}
        className={cn(
          "min-h-11 w-full rounded-xl border bg-surface-2 px-3 text-base text-text-primary sm:text-sm",
          "placeholder:text-text-muted",
          "focus:outline-none focus:ring-2 focus:ring-primary/40",
          error ? "border-danger" : "border-border focus:border-primary",
          className,
        )}
        {...rest}
      />
      {error ? (
        <p className="text-xs text-danger">{error}</p>
      ) : hint ? (
        <p className="text-xs text-text-muted">{hint}</p>
      ) : null}
    </div>
  );
});
