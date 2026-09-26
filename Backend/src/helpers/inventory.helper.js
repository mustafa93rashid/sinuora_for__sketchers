const ProductVariant = require(
  "../models/productVariant.model",
);

const InventoryTransaction = require(
  "../models/inventoryTransaction.model",
);

// ==================== Inventory Helper ====================

class InventoryHelper {
  // ==================== Validate Quantity ====================

  validateQuantity = (quantity) => {
    if (
      !Number.isInteger(quantity) ||
      quantity <= 0
    ) {
      const error = new Error(
        "Quantity must be a positive integer",
      );

      error.statusCode = 400;

      throw error;
    }
  };

  // ==================== Get Active Variant ====================

  getActiveVariant = async (
    variantId,
    session = null,
  ) => {
    let query = ProductVariant.findOne({
      _id: variantId,
      isActive: true,
    });

    if (session) {
      query = query.session(session);
    }

    const variant = await query;

    if (!variant) {
      const error = new Error(
        "Active product variant not found",
      );

      error.statusCode = 404;

      throw error;
    }

    return variant;
  };

  // ==================== Create Inventory Transaction ====================

  createTransaction = async ({
    variant,
    type,
    quantity,
    stockBefore,
    stockAfter,
    reservedBefore,
    reservedAfter,
    order = null,
    orderItem = null,
    reason = "",
    note = "",
    performedBy,
    session = null,
  }) => {
    if (!performedBy) {
      const error = new Error(
        "User is required for inventory transaction",
      );

      error.statusCode = 400;

      throw error;
    }

    const transactionData = {
      variant,
      type,
      quantity,

      stockBefore,
      stockAfter,

      reservedBefore,
      reservedAfter,

      order,
      orderItem,

      reason,
      note,

      performedBy,
    };

    const transactions =
      await InventoryTransaction.create(
        [transactionData],
        session
          ? {
              session,
            }
          : {},
      );

    return transactions[0];
  };

  // ==================== Add Stock ====================

  addStock = async ({
    variantId,
    quantity,
    performedBy,
    reason = "Stock added",
    note = "",
    session = null,
  }) => {
    this.validateQuantity(quantity);

    const variant =
      await this.getActiveVariant(
        variantId,
        session,
      );

    const stockBefore =
      variant.stockQuantity;

    const reservedBefore =
      variant.reservedQuantity;

    // ==================== Update Stock ====================

    variant.stockQuantity += quantity;

    await variant.save({
      session,
    });

    // ==================== Create Transaction ====================

    const transaction =
      await this.createTransaction({
        variant: variant._id,

        type: "IN",

        quantity,

        stockBefore,

        stockAfter:
          variant.stockQuantity,

        reservedBefore,

        reservedAfter:
          variant.reservedQuantity,

        reason,

        note,

        performedBy,

        session,
      });

    return {
      variant,
      transaction,
    };
  };

  // ==================== Reserve Stock ====================

  reserveStock = async ({
    variantId,
    quantity,
    order = null,
    orderItem = null,
    performedBy,
    reason = "Stock reserved for order",
    note = "",
    session = null,
  }) => {
    this.validateQuantity(quantity);

    // ==================== Atomic Reservation ====================

    const variant =
      await ProductVariant.findOneAndUpdate(
        {
          _id: variantId,

          isActive: true,

          $expr: {
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
        },

        {
          $inc: {
            reservedQuantity: quantity,
          },
        },

        {
          new: true,
          runValidators: true,
          session,
        },
      );

    if (!variant) {
      const error = new Error(
        "Insufficient available stock or variant not found",
      );

      error.statusCode = 409;

      throw error;
    }

    const stockAfter =
      variant.stockQuantity;

    const reservedAfter =
      variant.reservedQuantity;

    const stockBefore =
      stockAfter;

    const reservedBefore =
      reservedAfter - quantity;

    // ==================== Create Transaction ====================

    const transaction =
      await this.createTransaction({
        variant: variant._id,

        type: "RESERVE",

        quantity,

        stockBefore,

        stockAfter,

        reservedBefore,

        reservedAfter,

        order,

        orderItem,

        reason,

        note,

        performedBy,

        session,
      });

    return {
      variant,
      transaction,
    };
  };

  // ==================== Release Reserved Stock ====================

  releaseReservedStock = async ({
    variantId,
    quantity,
    order = null,
    orderItem = null,
    performedBy,
    reason = "Reserved stock released",
    note = "",
    session = null,
  }) => {
    this.validateQuantity(quantity);

    // ==================== Atomic Release ====================

    const variant =
      await ProductVariant.findOneAndUpdate(
        {
          _id: variantId,

          reservedQuantity: {
            $gte: quantity,
          },
        },

        {
          $inc: {
            reservedQuantity:
              -quantity,
          },
        },

        {
          new: true,
          runValidators: true,
          session,
        },
      );

    if (!variant) {
      const error = new Error(
        "Insufficient reserved stock or variant not found",
      );

      error.statusCode = 409;

      throw error;
    }

    const stockAfter =
      variant.stockQuantity;

    const reservedAfter =
      variant.reservedQuantity;

    const stockBefore =
      stockAfter;

    const reservedBefore =
      reservedAfter + quantity;

    // ==================== Create Transaction ====================

    const transaction =
      await this.createTransaction({
        variant: variant._id,

        type: "RELEASE_RESERVE",

        quantity,

        stockBefore,

        stockAfter,

        reservedBefore,

        reservedAfter,

        order,

        orderItem,

        reason,

        note,

        performedBy,

        session,
      });

    return {
      variant,
      transaction,
    };
  };

  // ==================== Confirm Sale ====================

  confirmSale = async ({
    variantId,
    quantity,
    order,
    orderItem = null,
    performedBy,
    reason = "Order sale confirmed",
    note = "",
    session = null,
  }) => {
    this.validateQuantity(quantity);

    // ==================== Atomic Sale ====================

    const variant =
      await ProductVariant.findOneAndUpdate(
        {
          _id: variantId,

          reservedQuantity: {
            $gte: quantity,
          },

          stockQuantity: {
            $gte: quantity,
          },
        },

        {
          $inc: {
            stockQuantity: -quantity,

            reservedQuantity:
              -quantity,
          },
        },

        {
          new: true,
          runValidators: true,
          session,
        },
      );

    if (!variant) {
      const error = new Error(
        "Unable to confirm sale because reserved stock is insufficient",
      );

      error.statusCode = 409;

      throw error;
    }

    const stockAfter =
      variant.stockQuantity;

    const reservedAfter =
      variant.reservedQuantity;

    const stockBefore =
      stockAfter + quantity;

    const reservedBefore =
      reservedAfter + quantity;

    // ==================== Create Transaction ====================

    const transaction =
      await this.createTransaction({
        variant: variant._id,

        type: "SALE",

        quantity,

        stockBefore,

        stockAfter,

        reservedBefore,

        reservedAfter,

        order,

        orderItem,

        reason,

        note,

        performedBy,

        session,
      });

    return {
      variant,
      transaction,
    };
  };

  // ==================== Return Stock ====================

  returnStock = async ({
    variantId,
    quantity,
    order,
    orderItem = null,
    performedBy,
    reason = "Order returned",
    note = "",
    session = null,
  }) => {
    this.validateQuantity(quantity);

    const variant =
      await this.getActiveVariant(
        variantId,
        session,
      );

    const stockBefore =
      variant.stockQuantity;

    const reservedBefore =
      variant.reservedQuantity;

    // ==================== Return Stock ====================

    variant.stockQuantity += quantity;

    await variant.save({
      session,
    });

    // ==================== Create Transaction ====================

    const transaction =
      await this.createTransaction({
        variant: variant._id,

        type: "RETURN",

        quantity,

        stockBefore,

        stockAfter:
          variant.stockQuantity,

        reservedBefore,

        reservedAfter:
          variant.reservedQuantity,

        order,

        orderItem,

        reason,

        note,

        performedBy,

        session,
      });

    return {
      variant,
      transaction,
    };
  };

  // ==================== Adjust Stock ====================

  adjustStock = async ({
    variantId,
    newQuantity,
    performedBy,
    reason,
    note = "",
    session = null,
  }) => {
    if (
      !Number.isInteger(newQuantity) ||
      newQuantity < 0
    ) {
      const error = new Error(
        "New stock quantity must be a non-negative integer",
      );

      error.statusCode = 400;

      throw error;
    }

    if (!reason?.trim()) {
      const error = new Error(
        "Reason is required for stock adjustment",
      );

      error.statusCode = 400;

      throw error;
    }

    const variant =
      await this.getActiveVariant(
        variantId,
        session,
      );

    // ==================== Protect Reserved Stock ====================

    if (
      newQuantity <
      variant.reservedQuantity
    ) {
      const error = new Error(
        "Stock quantity cannot be lower than reserved quantity",
      );

      error.statusCode = 409;

      throw error;
    }

    const stockBefore =
      variant.stockQuantity;

    const reservedBefore =
      variant.reservedQuantity;

    const difference =
      newQuantity - stockBefore;

    if (difference === 0) {
      const error = new Error(
        "New stock quantity is the same as the current stock quantity",
      );

      error.statusCode = 400;

      throw error;
    }

    // ==================== Update Stock ====================

    variant.stockQuantity =
      newQuantity;

    await variant.save({
      session,
    });

    // ==================== Create Transaction ====================

    const transaction =
      await this.createTransaction({
        variant: variant._id,

        type: "ADJUSTMENT",

        quantity:
          Math.abs(difference),

        stockBefore,

        stockAfter:
          variant.stockQuantity,

        reservedBefore,

        reservedAfter:
          variant.reservedQuantity,

        reason: reason.trim(),

        note,

        performedBy,

        session,
      });

    return {
      variant,
      transaction,
    };
  };
}

// ==================== Export Inventory Helper ====================

module.exports = new InventoryHelper();