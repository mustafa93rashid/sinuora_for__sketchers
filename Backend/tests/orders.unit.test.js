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

test("Order model rejects quantities and amounts that cannot be represented safely", async () => {
  const order = new Order({ orderNumber: "TEST", customer: body().customer, createdBy: id, subtotal: 100, totalAmount: 100,
    items: [{ variant: id, product: id, quantity: 1, unitPrice: 100, totalPrice: 100, dispatchedQuantity: 1, returnedQuantity: 1, deliveredQuantity: 1, productSnapshot: { name: "Shoe", color: "Black", size: 38 } }] });
  await assert.rejects(order.validate(), /Delivered and returned/);
  order.items[0].deliveredQuantity = 0;
  order.totalAmount = Number.MAX_SAFE_INTEGER + 1;
  await assert.rejects(order.validate(), /safe integer|Invalid total/);
});
