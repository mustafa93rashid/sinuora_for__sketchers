const mongoose = require("mongoose");

// ==================== Inventory Transaction Schema ====================

const inventoryTransactionSchema = new mongoose.Schema(
  {
    variant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ProductVariant",
      required: true,
      index: true,
    },

    type: {
      type: String,
      required: true,
      enum: [
        "IN",
        "RESERVE",
        "RELEASE_RESERVE",
        "SALE",
        "RETURN",
        "ADJUSTMENT",
      ],
      index: true,
    },

    quantity: {
      type: Number,
      required: true,
      min: 1,
    },

    stockBefore: {
      type: Number,
      required: true,
      min: 0,
    },

    stockAfter: {
      type: Number,
      required: true,
      min: 0,
    },

    reservedBefore: {
      type: Number,
      required: true,
      min: 0,
    },

    reservedAfter: {
      type: Number,
      required: true,
      min: 0,
    },

    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      default: null,
      index: true,
    },

    orderItem: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },

    reason: {
      type: String,
      trim: true,
      maxlength: 500,
    },

    note: {
      type: String,
      trim: true,
      maxlength: 1000,
    },

    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
  },
);

// ==================== Variant Transactions Index ====================

inventoryTransactionSchema.index({
  variant: 1,
  createdAt: -1,
});

// ==================== Order Transactions Index ====================

inventoryTransactionSchema.index({
  order: 1,
  createdAt: -1,
});

// ==================== Transaction Type Index ====================

inventoryTransactionSchema.index({
  type: 1,
  createdAt: -1,
});

// ==================== Model ====================

const InventoryTransaction = mongoose.model(
  "InventoryTransaction",
  inventoryTransactionSchema,
);

// ==================== Export ====================

module.exports = InventoryTransaction;