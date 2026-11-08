import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { Order, Role, Variant } from "./types";
export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));
export const money = (n = 0) =>
  `${new Intl.NumberFormat("en", { maximumFractionDigits: 0 }).format(n)}${import.meta.env.VITE_CURRENCY_LABEL ? ` ${import.meta.env.VITE_CURRENCY_LABEL}` : ""}`;
export const date = (value: string) =>
  new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Baghdad",
  }).format(new Date(value));
export const admin = (role?: Role) =>
  role === "superadmin" || role === "manager";
export const roleLabel = (role: Role) =>
  ({
    superadmin: "Super admin",
    manager: "Manager",
    saler: "Sales",
    "follow-up": "Follow-up",
  })[role];
export const available = (v: Variant) =>
  v.availableQuantity ?? v.stockQuantity - v.reservedQuantity;
export function actionsFor(order: Order, role: Role, userId: string) {
  const manager = admin(role),
    owner = role === "saler" && order.createdBy === userId;
  const follow = manager || owner || role === "follow-up";
  return {
    edit: (manager || owner) && ["New", "Preparing"].includes(order.status),
    cancel:
      (manager || owner) &&
      ["New", "Preparing", "Prepared"].includes(order.status),
    prepare: manager && order.status === "New",
    prepared: manager && order.status === "Preparing",
    dispatch: manager && order.status === "Prepared",
    deliver:
      follow &&
      ["Out For Delivery", "Partially Returned"].includes(order.status) &&
      order.items.some(
        (i) => i.dispatchedQuantity > i.returnedQuantity + i.deliveredQuantity,
      ),
    returns:
      follow &&
      ["Out For Delivery", "Delivered", "Partially Returned"].includes(
        order.status,
      ) &&
      order.items.some((i) => i.dispatchedQuantity > i.returnedQuantity),
  };
}
