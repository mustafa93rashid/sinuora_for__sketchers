const { test } = require("node:test");
const assert = require("node:assert/strict");

test("Product variant size enum and validation rules share the same size list, so they cannot drift apart", () => {
  const { PRODUCT_SIZES } = require("../src/config/productSizes");
  const Variant = require("../src/models/productVariant.model");
  const sizePath = Variant.schema.path("size");
  // Mongoose clones the array it's given rather than keeping the exact
  // reference, so this checks values, not identity - the actual risk
  // (L-11) was two independently-maintained lists drifting apart.
  assert.deepEqual(sizePath.enumValues, PRODUCT_SIZES);
});
