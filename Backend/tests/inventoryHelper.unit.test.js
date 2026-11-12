const { test } = require("node:test");
const assert = require("node:assert/strict");
const helper = require("../src/helpers/inventory.helper");

const id = "abcdef123456abcdef123456";
const otherId = "123456abcdef123456abcdef";

// ==================== validateMovement ====================

test("validateMovement rejects an unsupported movement type", () => {
  assert.throws(
    () => helper.validateMovement("TELEPORT", { variantId: id, performedBy: id, quantity: 1 }),
    { statusCode: 400 },
  );
});

test("validateMovement rejects invalid variant/performer IDs", () => {
  assert.throws(() => helper.validateMovement("IN", { variantId: "not-an-id", performedBy: id, quantity: 1 }));
  assert.throws(() => helper.validateMovement("IN", { variantId: id, performedBy: "not-an-id", quantity: 1 }));
});

test("validateMovement requires order and orderItem for RESERVE/RELEASE_RESERVE/SALE but not for IN/ADJUSTMENT", () => {
  for (const type of ["RESERVE", "RELEASE_RESERVE", "SALE"]) {
    assert.throws(() => helper.validateMovement(type, { variantId: id, performedBy: id, quantity: 1 }), { statusCode: 400 });
    assert.doesNotThrow(() => helper.validateMovement(type, { variantId: id, performedBy: id, quantity: 1, order: id, orderItem: id }));
  }
  assert.doesNotThrow(() => helper.validateMovement("IN", { variantId: id, performedBy: id, quantity: 1 }));
});

test("validateMovement allows ADJUSTMENT's newQuantity to be zero but rejects a zero quantity everywhere else", () => {
  assert.doesNotThrow(() => helper.validateMovement("ADJUSTMENT", { variantId: id, performedBy: id, newQuantity: 0 }));
  assert.throws(() => helper.validateMovement("IN", { variantId: id, performedBy: id, quantity: 0 }));
});

test("validateMovement rejects a non-string reason or note", () => {
  assert.throws(() => helper.validateMovement("IN", { variantId: id, performedBy: id, quantity: 1, reason: 42 }));
  assert.throws(() => helper.validateMovement("IN", { variantId: id, performedBy: id, quantity: 1, note: {} }));
});

// ==================== buildMovement ====================

test("buildMovement requires an active variant for IN and RESERVE", () => {
  assert.equal(helper.buildMovement("IN", { variantId: id, quantity: 5 }).filter.isActive, true);
  assert.equal(helper.buildMovement("RESERVE", { variantId: id, quantity: 5 }).filter.isActive, true);
});

test("buildMovement does not require an active variant for RETURN (audit finding L-5) or ADJUSTMENT (audit finding M-4)", () => {
  assert.equal(helper.buildMovement("RETURN", { variantId: id, quantity: 5 }).filter.isActive, undefined);
  assert.equal(helper.buildMovement("ADJUSTMENT", { variantId: id, newQuantity: 10 }).filter.isActive, undefined);
});

test("buildMovement's IN/RETURN guard against integer overflow and increments stockQuantity", () => {
  const { filter, update } = helper.buildMovement("IN", { variantId: id, quantity: 5 });
  assert.equal(filter.stockQuantity.$lte, Number.MAX_SAFE_INTEGER - 5);
  assert.deepEqual(update.$inc, { stockQuantity: 5 });
});

test("buildMovement's RESERVE only succeeds when enough unreserved stock is actually available", () => {
  const { filter, update } = helper.buildMovement("RESERVE", { variantId: id, quantity: 3 });
  assert.deepEqual(update.$inc, { reservedQuantity: 3 });
  assert.deepEqual(filter.$expr.$and[3], {
    $gte: [{ $subtract: ["$stockQuantity", "$reservedQuantity"] }, 3],
  });
});

test("buildMovement's RELEASE_RESERVE refuses to release more than is currently reserved", () => {
  const { filter, update } = helper.buildMovement("RELEASE_RESERVE", { variantId: id, quantity: 2 });
  assert.deepEqual(filter.reservedQuantity, { $gte: 2 });
  assert.deepEqual(update.$inc, { reservedQuantity: -2 });
});

test("buildMovement's SALE requires both reserved and physical stock to cover the quantity, and decrements both atomically", () => {
  const { filter, update } = helper.buildMovement("SALE", { variantId: id, quantity: 4 });
  assert.deepEqual(filter.reservedQuantity, { $gte: 4 });
  assert.deepEqual(filter.stockQuantity, { $gte: 4 });
  assert.deepEqual(update.$inc, { stockQuantity: -4, reservedQuantity: -4 });
});

test("buildMovement's ADJUSTMENT sets an absolute stock figure and refuses a no-op write", () => {
  const { filter, update } = helper.buildMovement("ADJUSTMENT", { variantId: id, newQuantity: 20 });
  assert.deepEqual(filter.stockQuantity, { $ne: 20 });
  assert.deepEqual(filter.reservedQuantity, { $lte: 20 });
  assert.deepEqual(update.$set.stockQuantity, 20);
});

test("buildMovement's QUARANTINE_RETURN increments quarantinedQuantity and tolerates a never-quarantined variant", () => {
  const { filter, update } = helper.buildMovement("QUARANTINE_RETURN", { variantId: id, quantity: 1 });
  assert.deepEqual(update.$inc, { quarantinedQuantity: 1 });
  assert.deepEqual(filter.$or[0], { quarantinedQuantity: { $exists: false } });
});

test("buildMovement always locks the variant's identity, regardless of movement type", () => {
  for (const [type, options] of [
    ["IN", { quantity: 1 }],
    ["RESERVE", { quantity: 1 }],
    ["RELEASE_RESERVE", { quantity: 1 }],
    ["SALE", { quantity: 1 }],
    ["RETURN", { quantity: 1 }],
    ["ADJUSTMENT", { newQuantity: 0 }],
    ["QUARANTINE_RETURN", { quantity: 1 }],
  ]) {
    const { update } = helper.buildMovement(type, { variantId: id, ...options });
    assert.equal(update.$set.identityLocked, true, `${type} should lock identity`);
  }
});

test("buildMovement scopes every filter to the given variant", () => {
  assert.equal(helper.buildMovement("IN", { variantId: otherId, quantity: 1 }).filter._id, otherId);
});
