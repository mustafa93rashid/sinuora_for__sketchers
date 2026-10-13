const ProductVariant = require("../models/productVariant.model");
const InventoryTransaction = require("../models/inventoryTransaction.model");
const runTransaction = require("./transaction.helper");

// ==================== Inventory Helper ====================

class InventoryHelper {
  getActiveVariant = async (variantId, session = null) => {
    const variant = await ProductVariant.findOne({ _id: variantId, isActive: true }).session(session);
    if (!variant) throw Object.assign(new Error("Active product variant not found"), { statusCode: 404 });
    return variant;
  };

  // ==================== Create Inventory Transaction ====================

  createTransaction = async (data, session = null) => {
    const transaction = new InventoryTransaction(data);
    return transaction.save({ session });
  };

  // ==================== Atomic Stock Movement ====================

  moveStock = async (type, options) => {
    const { variantId, quantity, newQuantity, order = null, orderItem = null, reason, note, performedBy, session = null } = options;
    const amount = type === "ADJUSTMENT" ? newQuantity : quantity;
    if (!Number.isSafeInteger(amount) || amount < (type === "ADJUSTMENT" ? 0 : 1)) {
      throw Object.assign(new Error("Stock quantity must be a valid integer"), { statusCode: 400 });
    }
    const result = await runTransaction(async (activeSession) => {
      const filter = { _id: variantId };
      let update;
      if (["IN", "RESERVE", "ADJUSTMENT"].includes(type)) filter.isActive = true;
      if (type === "IN" || type === "RETURN") {
        filter.stockQuantity = { $lte: Number.MAX_SAFE_INTEGER - quantity };
        update = { $inc: { stockQuantity: quantity } };
      } else if (type === "RESERVE") {
        filter.$expr = { $gte: [{ $subtract: ["$stockQuantity", "$reservedQuantity"] }, quantity] };
        update = { $inc: { reservedQuantity: quantity } };
      } else if (type === "RELEASE_RESERVE" || type === "SALE") {
        filter.reservedQuantity = { $gte: quantity };
        update = { $inc: { reservedQuantity: -quantity } };
        if (type === "SALE") {
          filter.stockQuantity = { $gte: quantity };
          update.$inc.stockQuantity = -quantity;
        }
      } else if (type === "ADJUSTMENT") {
        filter.reservedQuantity = { $lte: newQuantity };
        filter.stockQuantity = { $ne: newQuantity };
        update = { $set: { stockQuantity: newQuantity } };
      } else {
        throw new Error("Unsupported stock movement");
      }
      const before = await ProductVariant.findOneAndUpdate(filter, update, { returnDocument: "before", session: activeSession });
      if (!before) throw Object.assign(new Error("Stock movement rejected: variant unavailable, insufficient stock, or unchanged quantity"), { statusCode: 409 });
      const after = await ProductVariant.findById(before._id).session(activeSession);
      await this.createTransaction({
        variant: before._id, type,
        quantity: type === "ADJUSTMENT" ? Math.abs(newQuantity - before.stockQuantity) : quantity,
        stockBefore: before.stockQuantity, stockAfter: after.stockQuantity,
        reservedBefore: before.reservedQuantity, reservedAfter: after.reservedQuantity,
        order, orderItem, reason, note, performedBy,
      }, activeSession);
      return after;
    }, session);
    if (!session) result.$session(null);
    return result;
  };

  // ==================== Stock Operations ====================

  addStock = (options) => this.moveStock("IN", options);
  reserveStock = (options) => this.moveStock("RESERVE", options);
  releaseReservedStock = (options) => this.moveStock("RELEASE_RESERVE", options);
  confirmSale = (options) => this.moveStock("SALE", options);
  returnStock = (options) => this.moveStock("RETURN", options);
  adjustStock = (options) => this.moveStock("ADJUSTMENT", options);
}

module.exports = new InventoryHelper();
