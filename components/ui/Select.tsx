import { forwardRef, type SelectHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  hint?: string;
  error?: string;
  options?: SelectOption[];
  children?: ReactNode;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, hint, error, options, children, className, id, ...rest },
  ref,
) {
  const selectId = id ?? rest.name;
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={selectId} className="text-xs font-medium text-text-secondary">
          {label}
        </label>
      )}
      <select
        ref={ref}
        id={selectId}
        className={cn(
          "min-h-11 w-full rounded-xl border bg-surface-2 px-3 text-base text-text-primary sm:text-sm",
          "focus:outline-none focus:ring-2 focus:ring-primary/40",
          error ? "border-danger" : "border-border focus:border-primary",
          className,
        )}
        {...rest}
      >
        {options
          ? options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))
          : children}
      </select>
      {error ? (
        <p className="text-xs text-danger">{error}</p>
      ) : hint ? (
        <p className="text-xs text-text-muted">{hint}</p>
      ) : null}
    </div>
  );
});
