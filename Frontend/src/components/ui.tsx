const badgeStyles: Record<string, string> = {
  New: "badge-new text-[#427cad] bg-[#edf4fb]",
  Preparing: "badge-preparing text-[#af8131] bg-[#fff6e3]",
  "Pending activation": "badge-pending-activation text-[#af8131] bg-[#fff6e3]",
  Prepared: "badge-prepared text-[#288475] bg-[#eaf6f0]",
  Active: "badge-active text-[#288475] bg-[#eaf6f0]",
  Delivered: "badge-delivered text-[#288475] bg-[#eaf6f0]",
  "Out For Delivery": "badge-out-for-delivery text-[#8062a7] bg-[#f3effb]",
  Returned: "badge-returned text-[#b7713c] bg-[#fff0e6]",
  "Partially Returned": "badge-partially-returned text-[#b7713c] bg-[#fff0e6]",
  Cancelled: "badge-cancelled text-[#ac5a58] bg-[#fceeed]",
  Inactive: "badge-inactive text-[#ac5a58] bg-[#fceeed]",
};
import { useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Slot } from "@radix-ui/react-slot";
import { cva } from "class-variance-authority";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  LoaderCircle,
  PackageOpen,
  X,
} from "lucide-react";
import { cn } from "../lib/utils";
import type { Pagination } from "../lib/types";
const buttonVariants = cva(
  "btn inline-flex items-center justify-center gap-[9px] min-h-[42px] [padding:10px_16px] [border:1px_solid_transparent] rounded-[8px] text-[12px] font-semibold whitespace-nowrap [transition:background_.15s,_box-shadow_.15s] max-[768px]:min-h-[44px]",
  {
    variants: {
      variant: {
        primary:
          "btn-primary bg-primary text-white [box-shadow:0_3px_7px_#00747812] [&:hover]:bg-[#005f63]",
        secondary:
          "btn-secondary bg-white [border-color:#dfe7e7] text-[#355052] [&:hover]:bg-[#f3f8f7]",
        ghost:
          "btn-ghost text-[#547073] bg-transparent [padding:8px_11px] [&:hover]:bg-[#edf5f4]",
        danger: "btn-danger bg-[#fff0ef] text-[#af433a] [border-color:#f6dedb]",
      },
    },
    defaultVariants: { variant: "primary" },
  },
);
export function Button({
  variant = "primary",
  asChild = false,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  asChild?: boolean;
}) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp className={cn(buttonVariants({ variant }), className)} {...props} />
  );
}
export function Badge({ children }: { children: ReactNode }) {
  return (
    <span
      className={cn(
        "badge inline-flex items-center gap-[6px] rounded-[5px] [padding:5px_8px] bg-[#eef2f3] text-[#65777a] text-[10px] font-semibold whitespace-nowrap [&::before]:[content:''] [&::before]:w-[5px] [&::before]:h-[5px] [&::before]:rounded-full [&::before]:[background:currentColor]",
        badgeStyles[String(children)] || "",
      )}
    >
      {children}
    </span>
  );
}
export function PageTitle({
  eyebrow = "WORKSPACE",
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div
      className={
        "page-title flex items-center justify-between gap-[20px] mb-[27px] [&_.muted]:text-[12px] [&_.muted]:mb-0 [&_.eyebrow]:text-[9px] [&_.eyebrow]:mb-[10px] min-[768px]:max-[1200px]:[&_h1]:text-[28px] max-[768px]:items-start max-[768px]:mb-[23px] max-[768px]:gap-[12px] max-[768px]:flex-wrap max-[768px]:[&_h1]:text-[27px] max-[768px]:[&_h1]:tracking-[-.8px] max-[768px]:[&_.muted]:text-[11px] max-[768px]:[&_.muted]:max-w-[290px] max-[768px]:[&>.btn]:min-h-[42px]"
      }
    >
      <div>
        <p
          className={
            "eyebrow text-[10px] tracking-[1.8px] font-bold text-primary mb-[12px] max-[768px]:text-[9px]"
          }
        >
          {eyebrow}
        </p>
        <h1>{title}</h1>
        <p className={"muted text-muted-foreground font-normal"}>
          {description}
        </p>
      </div>
      {action}
    </div>
  );
}
// Shared wrapper for every centered loading/empty/error-boundary state
// panel - previously this exact class string was hand-copied in four
// places (Loading and Empty here, plus the ErrorBoundary fallback and
// the 404 route in main.tsx), risking drift between them (audit
// finding M-11).
export function StateBlock({
  children,
  role,
}: {
  children: ReactNode;
  role?: string;
}) {
  return (
    <div
      className={
        "state flex flex-col items-center justify-center text-center [padding:50px_20px] min-h-[220px] text-[#5f6f71] [&_h3]:[margin:15px_0_7px] [&_h3]:text-[#3b6662] [&_p]:text-[12px] [&_p]:max-w-[350px] [&_p]:[margin:12px_0]"
      }
      role={role}
    >
      {children}
    </div>
  );
}
export function Loading() {
  return (
    <StateBlock role="status">
      <LoaderCircle className={"spin animate-spin"} />
      <p>Loading your workspace…</p>
    </StateBlock>
  );
}
export function ErrorBox({
  error,
  retry,
}: {
  error: unknown;
  retry?: () => void;
}) {
  return (
    <div
      className={
        "error flex gap-[10px] items-center bg-[#fff2f0] [border:1px_solid_#f4dcd8] text-[#a24b43] [padding:14px] rounded-[8px] text-[12px] leading-[1.6] [margin:12px_0] [overflow-wrap:anywhere] [&_span]:flex-1 max-[768px]:text-[11px] max-[768px]:flex-wrap max-[768px]:[&>.btn]:ml-auto"
      }
      role="alert"
    >
      <AlertCircle size={18} />
      <span>{error instanceof Error ? error.message : String(error)}</span>
      {retry && (
        <Button variant="ghost" onClick={retry}>
          Try again
        </Button>
      )}
    </div>
  );
}
export function Empty({
  title = "Nothing here yet",
  description = "Records will appear here when they are added.",
  action,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <StateBlock>
      <PackageOpen size={32} />
      <h3>{title}</h3>
      <p className={"muted text-muted-foreground font-normal"}>{description}</p>
      {action}
    </StateBlock>
  );
}
export function Pager({
  pagination,
  page,
  onChange,
}: {
  pagination?: Pagination;
  page: number;
  onChange: (n: number) => void;
}) {
  const pages = pagination?.totalPages || 1;
  return (
    <div
      className={
        "pager flex items-center justify-between gap-[12px] [padding:15px_20px] [border-top:1px_solid_var(--border)] text-[10px] text-muted-foreground [&>div]:flex [&>div]:gap-[8px] [&_.btn]:[padding:6px_10px] [&_.btn]:min-h-[32px] max-[768px]:[padding:14px] max-[768px]:text-[10px] max-[768px]:[&_.btn]:min-h-[40px] max-[768px]:[&_.btn]:[padding:8px_12px]"
      }
    >
      <span>
        {pagination?.total ?? 0} records · Page {page}{" "}
        of {pages}
      </span>
      <div>
        <Button
          variant="secondary"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
          aria-label="Previous page"
        >
          <ArrowLeft size={15} />
        </Button>
        <Button
          variant="secondary"
          disabled={page >= pages}
          onClick={() => onChange(page + 1)}
          aria-label="Next page"
        >
          <ArrowRight size={15} />
        </Button>
      </div>
    </div>
  );
}
export function Modal({
  title,
  description,
  open,
  onOpenChange,
  children,
}: {
  title: string;
  description?: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  children: ReactNode;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay
          className={
            "dialog-overlay fixed [inset:0] bg-[#102f3566] [backdrop-filter:blur(4px)] z-[100]"
          }
        />
        <Dialog.Content
          className={
            "dialog-content fixed top-[50%] left-[50%] [transform:translate(-50%,_-50%)] bg-white w-[min(540px,_calc(100%_-_32px))] max-h-[88dvh] overflow-auto [border:1px_solid_#e5ece9] rounded-[15px] [padding:30px] z-[101] [box-shadow:0_25px_90px_#16353033] [&>h2]:text-[23px] [&>h2]:[margin:0_32px_10px_0] [&>.muted]:text-[12px] [&>.muted]:mr-[15px] max-[768px]:[padding:25px_20px] max-[768px]:max-h-[88dvh] max-[768px]:[&>h2]:text-[21px]"
          }
        >
          <Dialog.Title>{title}</Dialog.Title>
          <Dialog.Description
            className={"muted text-muted-foreground font-normal"}
          >
            {description || "Review the information below before saving."}
          </Dialog.Description>
          <Dialog.Close
            className={
              "dialog-close absolute right-[18px] top-[18px] bg-[#f5f8f7] border-0 rounded-full [padding:8px] text-[#7a908d]"
            }
            aria-label="Close dialog"
          >
            <X size={20} />
          </Dialog.Close>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
export interface FieldSpec {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  value?: string | number;
  options?: { value: string; label: string }[];
  min?: number;
  max?: number;
  step?: number;
  hint?: string;
  disabled?: boolean;
  multiple?: boolean;
}
export function FieldsForm({
  fields,
  onSubmit,
  submit = "Save changes",
  children,
}: {
  fields: FieldSpec[];
  onSubmit: (data: FormData) => Promise<void>;
  submit?: string;
  children?: ReactNode;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>(null),
    [success, setSuccess] = useState(false);
  return (
    <form
      className={"form-stack grid gap-[18px] mt-[24px] max-[768px]:gap-[17px]"}
      onSubmit={async (e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        setBusy(true);
        setError(null);
        setSuccess(false);
        try {
          await onSubmit(data);
          setSuccess(true);
        } catch (e) {
          setError(e);
        } finally {
          setBusy(false);
        }
      }}
    >
      {fields.map((f) => (
        <label
          className={
            "field flex flex-col gap-[7px] min-w-0 [&>span]:text-[11px] [&>span]:font-[550] [&>span]:text-[#607c7e] [&_select]:w-full [&_small]:text-[10px]"
          }
          key={f.name}
        >
          <span>
            {f.label}
            {f.required && " *"}
          </span>
          {f.options ? (
            <select
              name={f.name}
              defaultValue={f.value}
              required={f.required}
              disabled={f.disabled}
            >
              {f.options.map((o) => (
                <option value={o.value} key={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          ) : f.type === "textarea" ? (
            <textarea
              dir="auto"
              name={f.name}
              defaultValue={f.value}
              required={f.required}
            />
          ) : (
            <input
              dir={f.type === "number" ? "ltr" : "auto"}
              name={f.name}
              type={f.type || "text"}
              defaultValue={f.type === "file" ? undefined : f.value}
              required={f.required}
              min={f.min}
              max={f.max}
              step={f.step}
              disabled={f.disabled}
              multiple={f.multiple}
              accept={
                f.type === "file"
                  ? "image/jpeg,image/png,image/webp"
                  : undefined
              }
              autoComplete={f.type === "password" ? "new-password" : undefined}
            />
          )}{" "}
          {f.hint && (
            <small className={"muted text-muted-foreground font-normal"}>
              {f.hint}
            </small>
          )}
        </label>
      ))}
      {children}
      {error != null && <ErrorBox error={error} />}{" "}
      {success && (
        <p
          className={
            "success bg-[#eef8f2] text-[#3b8168] [padding:15px] rounded-[8px] text-[12px] [&_p]:[margin:10px_0_0]"
          }
          role="status"
        >
          Saved successfully.
        </p>
      )}
      <Button disabled={busy} type="submit">
        {busy ? (
          <>
            <LoaderCircle size={16} className={"spin animate-spin"} />
            Saving…
          </>
        ) : (
          submit
        )}
      </Button>
    </form>
  );
}
export function BarChart({
  data,
  valueLabel,
  formatValue = String,
}: {
  data: { label: string; value: number }[];
  valueLabel: string;
  formatValue?: (value: number) => string;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div
      role="img"
      aria-label={`${valueLabel} by day: ${data
        .map((d) => `${d.label} ${formatValue(d.value)}`)
        .join(", ")}`}
      className={
        "bar-chart flex items-end gap-[3px] h-[110px] [padding:4px_2px_0]"
      }
    >
      {data.map((d) => (
        <div
          key={d.label}
          title={`${d.label}: ${formatValue(d.value)}`}
          className={
            "flex-1 min-w-[3px] bg-primary rounded-t-[4px] [transition:height_.2s]"
          }
          style={{
            height: `${Math.max((d.value / max) * 100, d.value > 0 ? 4 : 1)}%`,
          }}
        />
      ))}
    </div>
  );
}
export function RankedList({
  rows,
  emptyLabel,
  formatValue = String,
}: {
  rows: { label: string; value: number }[];
  emptyLabel: string;
  formatValue?: (value: number) => string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  if (!rows.length)
    return (
      <Empty title={`No ${emptyLabel} yet`} description="Nothing sold in this period." />
    );
  return (
    <ul className={"ranked-list flex flex-col gap-[10px]"}>
      {rows.map((r) => (
        <li
          key={r.label}
          className={"flex items-center gap-[10px] text-[11px]"}
        >
          <span
            className={
              "w-[150px] shrink-0 truncate text-[#466a66] font-medium"
            }
            title={r.label}
          >
            {r.label}
          </span>
          <span
            className={
              "flex-1 h-[8px] bg-[#f0f3f3] rounded-[4px] overflow-hidden"
            }
          >
            <span
              className={"block h-full bg-primary rounded-[4px]"}
              style={{ width: `${(r.value / max) * 100}%` }}
            />
          </span>
          <span
            className={
              "w-[42px] text-right tabular-nums text-muted-foreground"
            }
          >
            {formatValue(r.value)}
          </span>
        </li>
      ))}
    </ul>
  );
}
