const { test } = require("node:test");
const assert = require("node:assert/strict");
const { accountKeyGenerator } = require("../src/middlewares/limiter");

test("Account key generator normalizes email casing/whitespace so case tricks cannot split one account's throttle bucket", () => {
  assert.equal(accountKeyGenerator({ body: { email: "User@Example.com" }, ip: "1.1.1.1" }), "user@example.com");
  assert.equal(accountKeyGenerator({ body: { email: "  user@example.com  " }, ip: "1.1.1.1" }), "user@example.com");
  assert.equal(accountKeyGenerator({ body: {}, ip: "2.2.2.2" }), "2.2.2.2");
  assert.equal(accountKeyGenerator({ body: { email: "" }, ip: "2.2.2.2" }), "2.2.2.2");
});
