import { describe, expect, it } from "vitest";
import { admin, available, actionsFor, date, money, roleLabel } from "./utils";
import type { Order, OrderItem, Variant } from "./types";

const item = (overrides: Partial<OrderItem> = {}): OrderItem => ({
  _id: "item-1",
  variant: "variant-1",
  quantity: 1,
  unitPrice: 10000,
  totalPrice: 10000,
  dispatchedQuantity: 0,
  deliveredQuantity: 0,
  returnedQuantity: 0,
  productSnapshot: { name: "Shoe", modelCode: "SK-1", color: "Black", size: 40 },
  ...overrides,
});
const order = (overrides: Partial<Order> = {}): Order => ({
  _id: "order-1",
  orderNumber: "SN-1",
  customer: { name: "Customer", phone: "0770", address: "Baghdad" },
  items: [item()],
  status: "New",
  totalAmount: 10000,
  deliveryFee: 0,
  discount: 0,
  notes: "",
  createdAt: new Date().toISOString(),
  createdBy: "user-1",
  ...overrides,
});

describe("admin", () => {
  it("treats superadmin and manager as admin", () => {
    expect(admin("superadmin")).toBe(true);
    expect(admin("manager")).toBe(true);
  });
  it("treats saler, follow-up, and missing role as non-admin", () => {
    expect(admin("saler")).toBe(false);
    expect(admin("follow-up")).toBe(false);
    expect(admin(undefined)).toBe(false);
  });
});

describe("roleLabel", () => {
  it("maps every role to its display label", () => {
    expect(roleLabel("superadmin")).toBe("Super admin");
    expect(roleLabel("manager")).toBe("Manager");
    expect(roleLabel("saler")).toBe("Sales");
    expect(roleLabel("follow-up")).toBe("Follow-up");
  });
});

describe("available", () => {
  it("prefers the server-computed availableQuantity when present", () => {
    const v = { availableQuantity: 5, stockQuantity: 100, reservedQuantity: 1 } as Variant;
    expect(available(v)).toBe(5);
  });
  it("falls back to stockQuantity minus reservedQuantity otherwise", () => {
    const v = { stockQuantity: 12, reservedQuantity: 4 } as Variant;
    expect(available(v)).toBe(8);
  });
});

describe("money", () => {
  it("formats a number with thousands separators and no decimals", () => {
    expect(money(84000)).toBe("84,000");
    expect(money(0)).toBe("0");
  });
});

describe("date", () => {
  it("formats an ISO timestamp using the Baghdad timezone", () => {
    expect(date("2026-10-26T12:00:00.000Z")).toBe("26 Oct 2026");
  });
});

describe("actionsFor", () => {
  it("lets a manager edit, cancel, and prepare a New order", () => {
    const a = actionsFor(order({ status: "New" }), "manager", "other-user");
    expect(a.edit).toBe(true);
    expect(a.cancel).toBe(true);
    expect(a.prepare).toBe(true);
    expect(a.prepared).toBe(false);
    expect(a.dispatch).toBe(false);
  });
  it("lets a manager move a Preparing order to Prepared", () => {
    const a = actionsFor(order({ status: "Preparing" }), "manager", "other-user");
    expect(a.edit).toBe(true);
    expect(a.prepare).toBe(false);
    expect(a.prepared).toBe(true);
  });
  it("lets a manager dispatch a Prepared order but not edit or prepare it", () => {
    const a = actionsFor(order({ status: "Prepared" }), "manager", "other-user");
    expect(a.edit).toBe(false);
    expect(a.cancel).toBe(true);
    expect(a.prepared).toBe(false);
    expect(a.dispatch).toBe(true);
  });
  it("lets the owning saler edit and cancel their own New order, but never prepare/dispatch", () => {
    const a = actionsFor(order({ status: "New", createdBy: "saler-1" }), "saler", "saler-1");
    expect(a.edit).toBe(true);
    expect(a.cancel).toBe(true);
    expect(a.prepare).toBe(false);
    expect(a.dispatch).toBe(false);
  });
  it("blocks a non-owning saler from every action on someone else's order", () => {
    const a = actionsFor(order({ status: "New", createdBy: "saler-1" }), "saler", "saler-2");
    expect(a).toEqual({
      edit: false,
      cancel: false,
      prepare: false,
      prepared: false,
      dispatch: false,
      deliver: false,
      returns: false,
    });
  });
  it("lets follow-up mark delivery only while stock is actually out and undelivered", () => {
    const outstanding = order({
      status: "Out For Delivery",
      items: [item({ dispatchedQuantity: 3, deliveredQuantity: 1, returnedQuantity: 0 })],
    });
    const a = actionsFor(outstanding, "follow-up", "follow-1");
    expect(a.deliver).toBe(true);
    expect(a.returns).toBe(true);
  });
  it("hides deliver once every dispatched unit has been accounted for", () => {
    const settled = order({
      status: "Out For Delivery",
      items: [item({ dispatchedQuantity: 3, deliveredQuantity: 3, returnedQuantity: 0 })],
    });
    const a = actionsFor(settled, "follow-up", "follow-1");
    expect(a.deliver).toBe(false);
  });
  it("still allows returns on a Delivered order while units remain unreturned", () => {
    const delivered = order({
      status: "Delivered",
      items: [item({ dispatchedQuantity: 5, deliveredQuantity: 5, returnedQuantity: 0 })],
    });
    const a = actionsFor(delivered, "follow-up", "follow-1");
    expect(a.deliver).toBe(false);
    expect(a.returns).toBe(true);
  });
  it("hides returns once everything dispatched has already been returned", () => {
    const fullyReturned = order({
      status: "Delivered",
      items: [item({ dispatchedQuantity: 5, deliveredQuantity: 0, returnedQuantity: 5 })],
    });
    const a = actionsFor(fullyReturned, "follow-up", "follow-1");
    expect(a.returns).toBe(false);
  });
});
