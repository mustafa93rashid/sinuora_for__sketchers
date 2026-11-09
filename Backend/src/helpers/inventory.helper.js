const crypto = require("node:crypto");
const input = require("./orderInput.helper");
const { lockProduct } = require("./catalog.helper");

const mongoose = require("mongoose");

const ProductVariant = require("../models/productVariant.model");
const InventoryTransaction = require("../models/inventoryTransaction.model");
const runTransaction = require("./transaction.helper");

// ==================== Inventory Helper ====================

class InventoryHelper {
  // ==================== Error Handler ====================

  fail = (message, statusCode = 400) => {
    throw Object.assign(new Error(message), { statusCode });
  };

  // ==================== Validate Object ID ====================

  validateId = (value, field = "Resource ID") => {
    if (!mongoose.isValidObjectId(value)) {
      this.fail(`Invalid ${field}`);
    }

    return value;
  };

  // ==================== Validate Quantity ====================

  validateQuantity = (value, allowZero = false) => {
    if (
      !Number.isSafeInteger(value) ||
      value < (allowZero ? 0 : 1)
    ) {
      this.fail("Stock quantity must be a valid integer");
    }

    return value;
  };

  // ==================== Validate Stock Movement ====================

  validateMovement = (type, options) => {
    const allowedTypes = [
      "IN",
      "RESERVE",
      "RELEASE_RESERVE",
      "SALE",
      "RETURN",
      "QUARANTINE_RETURN",
      "ADJUSTMENT",
    ];

    if (!allowedTypes.includes(type)) {
      this.fail("Unsupported stock movement");
    }

    if (
      !options ||
      typeof options !== "object" ||
      Array.isArray(options)
    ) {
      this.fail("Invalid stock movement options");
    }

    this.validateId(options.variantId, "variant ID");
    this.validateId(options.performedBy, "user ID");

    if (options.order != null) {
      this.validateId(options.order, "order ID");
    }

    if (options.orderItem != null) {
      this.validateId(options.orderItem, "order item ID");
    }

    if (type === "ADJUSTMENT") {
      this.validateQuantity(options.newQuantity, true);
    } else {
      this.validateQuantity(options.quantity);
    }

    if (
      options.reason !== undefined &&
      options.reason !== null &&
      typeof options.reason !== "string"
    ) {
      this.fail("Invalid stock movement reason");
    }

    if (
      options.note !== undefined &&
      options.note !== null &&
      typeof options.note !== "string"
    ) {
      this.fail("Invalid stock movement note");
    }

    if (
      ["RESERVE", "RELEASE_RESERVE", "SALE"].includes(type) &&
      (!options.order || !options.orderItem)
    ) {
      this.fail("Order and order item are required");
    }

    return options;
  };

  // ==================== Get Active Variant ====================

  getActiveVariant = async (variantId, session = null) => {
    this.validateId(variantId, "variant ID");

    const variant = await ProductVariant.findOne({
      _id: variantId,
      isActive: true,
    }).session(session);

    if (!variant) {
      this.fail("Active product variant not found", 404);
    }

    return variant;
  };

  // ==================== Create Inventory Transaction ====================

  createTransaction = async (data, session = null) => {
    const transaction = new InventoryTransaction(data);

    return transaction.save({ session });
  };

  // ==================== Build Stock Movement ====================

  buildMovement = (type, options) => {
    const { variantId, quantity, newQuantity } = options;

    const filter = { _id: variantId };
    let update;

    // ==================== Active Variant Required ====================
    // ADJUSTMENT is deliberately excluded: an archived variant can
    // still carry a stale physical stock figure (e.g. a damaged write-
    // off, or an inflated count from a customer return - see RETURN
    // below), and restoring the variant just to zero it out and
    // re-archiving it is unnecessary friction for an admin correction
    // (audit finding M-4).

    if (["IN", "RESERVE"].includes(type)) {
      filter.isActive = true;
    }

    // ==================== Add Stock ====================
    // RETURN intentionally does not require isActive either: a
    // resellable return can arrive for an order placed before its
    // variant was discontinued, and staff must still be able to
    // record the physical stock coming back even though the item is
    // no longer sellable (audit finding L-5). The variant stays
    // archived - only its stock figure changes.

    if (type === "IN" || type === "RETURN") {
      filter.stockQuantity = {
        $lte: Number.MAX_SAFE_INTEGER - quantity,
      };

      update = {
        $inc: {
          stockQuantity: quantity,
        },
      };
    }

    // ==================== Reserve Stock ====================

    else if (type === "RESERVE") {
      filter.$expr = {
        $and: [
          { $gte: ["$stockQuantity", 0] },
          { $gte: ["$reservedQuantity", 0] },
          {
            $lte: [
              "$reservedQuantity",
              Number.MAX_SAFE_INTEGER - quantity,
            ],
          },
          {
            $gte: [
              {
                $subtract: [
                  "$stockQuantity",
                  "$reservedQuantity",
                ],
              },
              quantity,
            ],
          },
        ],
      };

      update = {
        $inc: {
          reservedQuantity: quantity,
        },
      };
    }

    // ==================== Release Reserved Stock ====================

    else if (type === "RELEASE_RESERVE") {
      filter.reservedQuantity = {
        $gte: quantity,
      };

      update = {
        $inc: {
          reservedQuantity: -quantity,
        },
      };
    }

    // ==================== Confirm Sale ====================

    else if (type === "SALE") {
      filter.reservedQuantity = {
        $gte: quantity,
      };

      filter.stockQuantity = {
        $gte: quantity,
      };

      update = {
        $inc: {
          stockQuantity: -quantity,
          reservedQuantity: -quantity,
        },
      };
    }

    // ==================== Adjust Stock ====================

    else if (type === "ADJUSTMENT") {
      filter.reservedQuantity = {
        $lte: newQuantity,
      };

      filter.stockQuantity = {
        $ne: newQuantity,
      };

      update = {
        $set: {
          stockQuantity: newQuantity,
        },
      };
    }

    else if (type === "QUARANTINE_RETURN") {
      filter.$or = [{ quarantinedQuantity: { $exists: false } }, { quarantinedQuantity: { $lte: Number.MAX_SAFE_INTEGER - quantity } }];
      update = { $inc: { quarantinedQuantity: quantity } };
    }
    update.$set = { ...update.$set, identityLocked: true };
    return { filter, update };
  };

  // ==================== Atomic Stock Movement ====================

  moveStock = async (type, options) => {
    this.validateMovement(type, options);

    const {
      variantId,
      quantity,
      newQuantity,
      order = null,
      orderItem = null,
      reason,
      note,
      performedBy,
      session = null,
    } = options;

    const key = options.key == null ? null : input.key(options.key);
    if (key && !["IN", "ADJUSTMENT"].includes(type)) this.fail("Idempotency key is only supported for manual stock operations");
    const identity = { performedBy, variant: variantId, type, idempotencyKey: key };
    const hash = key ? crypto.createHash("sha256").update(JSON.stringify({ quantity: quantity ?? null, newQuantity: newQuantity ?? null, reason: reason ?? "", note: note ?? "" })).digest("hex") : null;
    if (key) {
      this.indexesReady ||= InventoryTransaction.createIndexes().catch(error => { this.indexesReady = null; throw error; });
      await this.indexesReady;
    }
    const replay = async activeSession => {
      if (!key) return null;
      const movement = await InventoryTransaction.findOne(identity).session(activeSession);
      if (!movement) return null;
      if (movement.idempotencyHash !== hash) this.fail("Idempotency key already used with different data", 409);
      return ProductVariant.findById(variantId).session(activeSession);
    };
    let result;
    try {
    result = await runTransaction(async (activeSession) => {
      const existing = await replay(activeSession);
      if (existing) return existing;
      if (["IN", "RESERVE", "ADJUSTMENT"].includes(type)) {
        const variant = await ProductVariant.findById(variantId).session(activeSession);
        if (!variant) this.fail("Product variant not found", 404);
        // ADJUSTMENT must still work after the parent product itself
        // was archived (which cascades its variants inactive too), so
        // staff can zero out a stranded stock figure without
        // restoring the whole discontinued product line first.
        await lockProduct(variant.product, activeSession, type !== "ADJUSTMENT");
      }
      // ==================== Prepare Movement ====================

      const { filter, update } = this.buildMovement(type, {
        variantId,
        quantity,
        newQuantity,
      });

      // ==================== Atomic Update ====================

      const before = await ProductVariant.findOneAndUpdate(
        filter,
        update,
        {
          returnDocument: "before",
          session: activeSession,
        }
      );

      if (!before) {
        this.fail(
          "Stock movement rejected: variant unavailable, insufficient stock, or unchanged quantity",
          409
        );
      }

      // ==================== Get Updated Stock ====================

      const after = await ProductVariant.findById(
        before._id
      ).session(activeSession);

      if (!after) {
        this.fail("Updated product variant not found", 409);
      }

      // ==================== Calculate Movement Quantity ====================

      const movementQuantity =
        type === "ADJUSTMENT"
          ? Math.abs(newQuantity - before.stockQuantity)
          : quantity;

      if (!Number.isSafeInteger(movementQuantity)) {
        this.fail("Invalid inventory movement quantity");
      }

      // ==================== Record Inventory Transaction ====================

      await this.createTransaction(
        {
          ...(key && { idempotencyKey: key, idempotencyHash: hash }),
          quarantinedBefore: before.quarantinedQuantity ?? 0,
          quarantinedAfter: after.quarantinedQuantity ?? 0,
          variant: before._id,
          type,
          quantity: movementQuantity,

          stockBefore: before.stockQuantity,
          stockAfter: after.stockQuantity,

          reservedBefore: before.reservedQuantity,
          reservedAfter: after.reservedQuantity,

          order,
          orderItem,

          reason,
          note,
          performedBy,
        },
        activeSession
      );

      return after;
    }, session);
    } catch (error) {
      if (key && !session && error.code === 11000) result = await replay(null);
      if (!result) throw error;
    }

    // ==================== Detach Completed Session ====================

    if (!session && result) {
      result.$session(null);
    }

    return result;
  };

  // ==================== Add Stock ====================

  addStock = (options) => {
    return this.moveStock("IN", options);
  };

  // ==================== Reserve Stock ====================

  reserveStock = (options) => {
    return this.moveStock("RESERVE", options);
  };

  // ==================== Release Reserved Stock ====================

  releaseReservedStock = (options) => {
    return this.moveStock("RELEASE_RESERVE", options);
  };

  // ==================== Confirm Sale ====================

  confirmSale = (options) => {
    return this.moveStock("SALE", options);
  };

  // ==================== Return Stock ====================

  quarantineStock = (options) => this.moveStock("QUARANTINE_RETURN", options);

  returnStock = (options) => {
    return this.moveStock("RETURN", options);
  };

  // ==================== Adjust Stock ====================

  adjustStock = (options) => {
    return this.moveStock("ADJUSTMENT", options);
  };
}

// ==================== Export Helper ====================

module.exports = new InventoryHelper();
