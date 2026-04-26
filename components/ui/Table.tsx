import type {
  HTMLAttributes,
  TableHTMLAttributes,
  ThHTMLAttributes,
  TdHTMLAttributes,
  ReactNode,
} from "react";
import { cn } from "@/lib/cn";

export function Table({
  className,
  children,
  ...rest
}: TableHTMLAttributes<HTMLTableElement>) {
  return (
    <div className="w-full max-w-full overflow-x-auto rounded-xl border border-border shadow-[inset_-16px_0_16px_-18px_rgba(255,255,255,0.35)]">
      <table
        className={cn(
          "min-w-max w-full text-left text-sm text-text-primary",
          className,
        )}
        {...rest}
      >
        {children}
      </table>
    </div>
  );
}

export function THead({
  className,
  children,
  ...rest
}: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead
      className={cn(
        "bg-surface-2 text-xs uppercase tracking-wider text-text-secondary",
        className,
      )}
      {...rest}
    >
      {children}
    </thead>
  );
}

export function TBody({
  className,
  children,
  ...rest
}: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <tbody className={cn("divide-y divide-border", className)} {...rest}>
      {children}
    </tbody>
  );
}

export function TR({
  className,
  children,
  ...rest
}: HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr className={cn("hover:bg-surface-2/60 transition-colors", className)} {...rest}>
      {children}
    </tr>
  );
}

export function TH({
  className,
  children,
  ...rest
}: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn("whitespace-nowrap px-3 py-3 font-medium sm:px-4", className)}
      {...rest}
    >
      {children}
    </th>
  );
}

export function TD({
  className,
  children,
  ...rest
}: TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td className={cn("whitespace-nowrap px-3 py-3 sm:px-4", className)} {...rest}>
      {children}
    </td>
  );
}

export interface SimpleColumn<T> {
  key: string;
  header: ReactNode;
  render: (row: T) => ReactNode;
  className?: string;
}

export interface SimpleTableProps<T> {
  columns: SimpleColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  empty?: ReactNode;
}

export function SimpleTable<T>({ columns, rows, rowKey, empty }: SimpleTableProps<T>) {
  return (
    <Table>
      <THead>
        <TR>
          {columns.map((c) => (
            <TH key={c.key} className={c.className}>
              {c.header}
            </TH>
          ))}
        </TR>
      </THead>
      <TBody>
        {rows.length === 0 ? (
          <TR>
            <TD colSpan={columns.length} className="py-8 text-center text-text-muted">
              {empty ?? "No data"}
            </TD>
          </TR>
        ) : (
          rows.map((row) => (
            <TR key={rowKey(row)}>
              {columns.map((c) => (
                <TD key={c.key} className={c.className}>
                  {c.render(row)}
                </TD>
              ))}
            </TR>
          ))
        )}
      </TBody>
    </Table>
  );
}
