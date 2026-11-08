const Product = require("../models/product.model");
const Variant = require("../models/productVariant.model");
const Movement = require("../models/inventoryTransaction.model");
const Order = require("../models/order.model");
const runTransaction = require("./transaction.helper");
const fail = (message, statusCode = 409) => { throw Object.assign(new Error(message), { statusCode }); };

// Every stock admission and catalog status change writes the parent document.
// Snapshot reads alone cannot prevent archiving a product during reservation.
const lockProduct = async (id, session, activeOnly = true) => {
  const product = await Product.findOneAndUpdate(
    { _id: id, ...(activeOnly && { isActive: true }) },
    { $inc: { inventoryRevision: 1 } },
    { session, returnDocument: "after" },
  );
  if (!product) fail("Active product not found", 404);
  return product;
};

const setProductActive = (id, active, userId) => runTransaction(async session => {
  const product = await lockProduct(id, session, false);
  if (!active && await Variant.exists({ product: id, reservedQuantity: { $gt: 0 } }).session(session)) {
    fail("Cannot archive a product with reserved stock");
  }
  product.isActive = active;
  product.updatedBy = userId;
  await product.save({ session });
  product.$session(null);
  return product;
});

const createVariant = data => runTransaction(async session => {
  await lockProduct(data.product, session);
  const variant = new Variant(data);
  await variant.save({ session });
  variant.$session(null);
  return variant;
});

const updateVariant = (id, fields) => runTransaction(async session => {
  const variant = await Variant.findById(id).session(session);
  if (!variant) fail("Product variant not found", 404);
  await lockProduct(variant.product, session, false);
  const changed = Object.entries(fields).some(([key, value]) => value !== undefined && variant[key] !== value);
  if (changed) {
    const used = variant.identityLocked || variant.stockQuantity > 0 || variant.reservedQuantity > 0 ||
      variant.quarantinedQuantity > 0 || await Movement.exists({ variant: id }).session(session) ||
      await Order.exists({ "items.variant": id }).session(session);
    if (used) fail("A used variant cannot change color, size or SKU; create a new variant");
    for (const [key, value] of Object.entries(fields)) if (value !== undefined) variant[key] = value;
    await variant.save({ session });
  }
  variant.$session(null);
  return variant;
});

const setVariantActive = (id, active) => runTransaction(async session => {
  const variant = await Variant.findById(id).session(session);
  if (!variant) fail("Product variant not found", 404);
  await lockProduct(variant.product, session, active);
  const updated = await Variant.findOneAndUpdate(
    { _id: id, ...(!active && { reservedQuantity: 0 }) },
    { $set: { isActive: active }, $inc: { __v: 1 } },
    { session, returnDocument: "after" },
  );
  if (!updated) fail("Cannot archive a variant with reserved stock");
  updated.$session(null);
  return updated;
});

module.exports = { lockProduct, setProductActive, createVariant, updateVariant, setVariantActive };
