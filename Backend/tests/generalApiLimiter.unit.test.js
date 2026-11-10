const { test } = require("node:test");
const assert = require("node:assert/strict");
const auth = require("../src/middlewares/auth");

// express-rate-limit middleware functions all carry a resetKey method -
// used here as a library-agnostic marker rather than comparing against
// one shared instance, since each router now gets its own independent
// limiter (audit finding M-14 follow-up: a single shared instance meant
// one global budget across all five routers instead of five separate
// ones).
const isRateLimiter = (handle) => typeof handle?.resetKey === "function";

test("Product, variant, inventory, order and dashboard routers mount auth before their own rate limiter", () => {
  const routers = {
    product: require("../src/routers/product.route"),
    productVariant: require("../src/routers/productVariant.routes"),
    inventory: require("../src/routers/inventory.routes"),
    order: require("../src/routers/order.routes"),
    dashboard: require("../src/routers/dashboard.routes"),
  };

  for (const [name, router] of Object.entries(routers)) {
    const authIndex = router.stack.findIndex((layer) => layer.handle === auth);
    const limiterIndex = router.stack.findIndex((layer) => isRateLimiter(layer.handle));

    assert.ok(authIndex !== -1, `expected ${name} router to mount auth globally`);
    assert.ok(limiterIndex !== -1, `expected ${name} router to mount a rate limiter`);
    assert.ok(
      authIndex < limiterIndex,
      `expected ${name} router to run auth before the rate limiter, so unauthenticated requests are rejected before they can consume its budget`
    );
  }
});

test("Each router gets its own rate limiter instance, not one shared budget across all five", () => {
  const product = require("../src/routers/product.route");
  const order = require("../src/routers/order.routes");
  const productLimiter = product.stack.find((layer) => isRateLimiter(layer.handle)).handle;
  const orderLimiter = order.stack.find((layer) => isRateLimiter(layer.handle)).handle;
  assert.notEqual(productLimiter, orderLimiter, "expected independent limiter instances per router");
});
