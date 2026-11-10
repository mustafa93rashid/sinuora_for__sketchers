const { test } = require("node:test");
const assert = require("node:assert/strict");
const { generalApiLimiter } = require("../src/middlewares/limiter");

// express-rate-limit is a mature, independently-tested third-party
// package - this checks that each previously-unprotected router
// actually mounts it (audit finding M-14), not the library's own
// throttling correctness.
const isMounted = (router) => router.stack.some((layer) => layer.handle === generalApiLimiter);

test("Product, variant, inventory, order and dashboard routers all mount the general API limiter", () => {
  const routers = {
    product: require("../src/routers/product.route"),
    productVariant: require("../src/routers/productVariant.routes"),
    inventory: require("../src/routers/inventory.routes"),
    order: require("../src/routers/order.routes"),
    dashboard: require("../src/routers/dashboard.routes"),
  };

  for (const [name, router] of Object.entries(routers)) {
    assert.ok(isMounted(router), `expected the ${name} router to mount generalApiLimiter`);
  }
});
