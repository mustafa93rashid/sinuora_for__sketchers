const { test } = require("node:test");
const assert = require("node:assert/strict");
const input = require("../src/helpers/orderInput.helper");
const Order = require("../src/models/order.model");
const helper = require("../src/helpers/order.helper");

// ==================== Input And Permission Regression Tests ====================

const id = "abcdef123456abcdef123456";
const body = () => ({ customer: { name: "Customer", phone: "123", address: "Baghdad" }, items: [{ variant: id, quantity: 3, unitPrice: 100 }] });

test("Reject unknown fields, malformed customers and unsafe prices", () => {
  for (const field of ["status", "createdBy", "returnedQuantity", "totalAmount"]) assert.throws(() => input.order({ ...body(), [field]: 0 }));
  for (const customer of [null, [], "name", { name: {}, address: "a", phone: "123" }]) assert.throws(() => input.order({ ...body(), customer }), { statusCode: 400 });
  for (const quantity of [-1, 0, 1.5, "1", Number.MAX_SAFE_INTEGER + 1]) assert.throws(() => input.order({ ...body(), items: [{ variant: id, quantity, unitPrice: 1 }] }));
  assert.throws(() => input.order({ ...body(), items: [{ variant: id, quantity: 1, unitPrice: 0.1 }] }));
});

test("Partial update validates only supplied fields and prevents empty updates", () => {
  assert.deepEqual(input.order({ notes: " note " }, true), { notes: "note" });
  assert.deepEqual(input.order({ discount: 1 }, true), { discount: 1 });
  assert.throws(() => input.order({}, true));
});

test("Normalize return identity and reject duplicate IDs in different cases", () => {
  const items = [{ orderItem: id, quantity: 1 }, { orderItem: id.toUpperCase(), quantity: 1 }];
  assert.throws(() => input.returns({ items, reason: "REFUSED" }));
  const a = input.returns({ reason: "REFUSED", items: [{ quantity: 1, orderItem: id.toUpperCase() }] });
  const b = input.returns({ items: [{ orderItem: id, quantity: 1 }], reason: "REFUSED", note: "" });
  assert.equal(helper.createHash(a), helper.createHash(b));
  for (const key of [undefined, "", " ", "bad key", "x".repeat(129)]) assert.throws(() => input.key(key));
  assert.throws(() => input.action({ reason: "   " }, true));
});

test("New role permissions retain seller ownership scope", async () => {
  assert.deepEqual(helper.scope({ role: "saler", _id: id }), { createdBy: id });
  assert.deepEqual(helper.scope({ role: "manager" }), {});
  assert.equal(helper.isFollowUp({ role: "manager" }), true);
  assert.equal(helper.isFollowUp({ role: "saler" }), true);
  for (const method of ["startPreparing", "markPrepared", "dispatchOrder"]) await assert.rejects(helper[method]({ user: { role: "saler" }, id }), { statusCode: 403 });
});

test("Pricing policy flags below-cost and out-of-tolerance item prices, allows compliant and unset-catalog prices", () => {
  assert.deepEqual(helper.evaluateItemPricing({ unitPrice: 100, catalogPrice: 100, catalogCost: 70 }), []);
  assert.deepEqual(helper.evaluateItemPricing({ unitPrice: 115, catalogPrice: 100, catalogCost: 70 }), []);
  assert.deepEqual(helper.evaluateItemPricing({ unitPrice: 85, catalogPrice: 100, catalogCost: 70 }), []);
  assert.deepEqual(helper.evaluateItemPricing({ unitPrice: 60, catalogPrice: 100, catalogCost: 70 }), ["below_cost", "price_deviation"]);
  assert.deepEqual(helper.evaluateItemPricing({ unitPrice: 200, catalogPrice: 100, catalogCost: 70 }), ["price_deviation"]);
  assert.deepEqual(helper.evaluateItemPricing({ unitPrice: 80, catalogPrice: 0, catalogCost: 0 }), []);
});

test("Discount policy caps discount at 20% of the pre-discount order amount, ignores a zero base amount", () => {
  assert.deepEqual(helper.evaluateDiscountPolicy({ discount: 20, baseAmount: 100 }), []);
  assert.deepEqual(helper.evaluateDiscountPolicy({ discount: 21, baseAmount: 100 }), ["discount_exceeds_cap"]);
  assert.deepEqual(helper.evaluateDiscountPolicy({ discount: 0, baseAmount: 0 }), []);
});

test("Pricing policy enforcement blocks non-admin roles and records an exception for admin roles instead", () => {
  assert.throws(() => helper.enforcePricingPolicy({ user: { role: "saler" }, reasons: ["below_cost"] }), { statusCode: 403 });
  assert.deepEqual(helper.enforcePricingPolicy({ user: { role: "saler" }, reasons: [] }), { exception: false, reasons: [] });
  assert.deepEqual(helper.enforcePricingPolicy({ user: { role: "manager" }, reasons: ["below_cost"] }), { exception: true, reasons: ["below_cost"] });
  assert.deepEqual(helper.enforcePricingPolicy({ user: { role: "superadmin" }, reasons: [] }), { exception: false, reasons: [] });
});

test("Order scope restricts follow-up to post-preparation statuses and denies unknown roles entirely", () => {
  assert.deepEqual(helper.scope({ role: "follow-up" }), { status: { $in: ["Prepared", "Out For Delivery", "Delivered", "Returned", "Partially Returned"] } });
  assert.deepEqual(helper.scope({ role: "unknown" }), { _id: { $in: [] } });
  assert.deepEqual(helper.scope(undefined), { _id: { $in: [] } });
});

test("Serialize strips idempotency internals for every role, and cost/price-exception fields for non-admins only", () => {
  const raw = () => ({
    idempotencyKey: "key-1", idempotencyHash: "hash-1", priceException: true, priceExceptionReasons: ["below_cost"],
    items: [{ unitCost: 50, totalCost: 150, priceException: true, priceExceptionReasons: ["below_cost"], unitPrice: 100 }],
  });

  const forSaler = helper.serialize(raw(), { role: "saler" });
  assert.equal(forSaler.idempotencyKey, undefined);
  assert.equal(forSaler.idempotencyHash, undefined);
  assert.equal(forSaler.priceException, undefined);
  assert.equal(forSaler.priceExceptionReasons, undefined);
  assert.equal(forSaler.items[0].unitCost, undefined);
  assert.equal(forSaler.items[0].totalCost, undefined);
  assert.equal(forSaler.items[0].priceException, undefined);
  assert.equal(forSaler.items[0].unitPrice, 100); // non-cost fields survive

  const forManager = helper.serialize(raw(), { role: "manager" });
  assert.equal(forManager.idempotencyKey, undefined); // always stripped, even for admins
  assert.equal(forManager.priceException, true);
  assert.equal(forManager.items[0].unitCost, 50);
  assert.equal(forManager.items[0].priceExceptionReasons[0], "below_cost");

  assert.equal(helper.serialize(null), null);
});

test("Order model rejects quantities and amounts that cannot be represented safely", async () => {
  const order = new Order({ orderNumber: "TEST", customer: body().customer, createdBy: id, subtotal: 100, totalAmount: 100,
    items: [{ variant: id, product: id, quantity: 1, unitPrice: 100, totalPrice: 100, dispatchedQuantity: 1, returnedQuantity: 1, deliveredQuantity: 1, productSnapshot: { name: "Shoe", color: "Black", size: 38 } }] });
  await assert.rejects(order.validate(), /Delivered and returned/);
  order.items[0].deliveredQuantity = 0;
  order.totalAmount = Number.MAX_SAFE_INTEGER + 1;
  await assert.rejects(order.validate(), /safe integer|Invalid total/);
});
