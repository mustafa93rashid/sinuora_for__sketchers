const mongoose = require("mongoose");

// ==================== Return Reasons ====================

const RETURN_REASONS = [
  "NO_ANSWER",
  "REFUSED",
  "WRONG_ADDRESS",
  "CHANGED_MIND",
  "SIZE_ISSUE",
  "DAMAGED",
  "OTHER",
];

// ==================== Return Item Schema ====================

const returnItemSchema = new mongoose.Schema({
  orderItem: { type: mongoose.Schema.Types.ObjectId, required: true },

  variant: { type: mongoose.Schema.Types.ObjectId, ref: "ProductVariant", required: true },

  quantity: { type: Number, required: true, min: 1, validate: Number.isSafeInteger },

  unitPrice: { type: Number, required: true, min: 0, validate: Number.isSafeInteger },

  totalPrice: { type: Number, required: true, min: 0, validate: Number.isSafeInteger },
}, { _id: true });

// ==================== Order Return Schema ====================

const orderReturnSchema = new mongoose.Schema({
  order: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true, index: true },

  items: {
    type: [returnItemSchema],
    required: true,
    validate: {
      validator: (items) => items.length > 0 && items.length <= 100,
      message: "Return must contain at least one item",
    },
  },

  type: { type: String, enum: ["FULL", "PARTIAL"], required: true },

  reason: { type: String, enum: RETURN_REASONS, required: true },

  note: { type: String, trim: true, maxlength: 1000 },

  returnedAmount: { type: Number, required: true, min: 0, validate: Number.isSafeInteger },

  processedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

  idempotencyKey: { type: String, trim: true },
  idempotencyHash: { type: String },
}, { timestamps: true });

// ==================== Order Return Indexes ====================

orderReturnSchema.index({ order: 1, createdAt: -1 });
orderReturnSchema.index({ processedBy: 1, createdAt: -1 });
orderReturnSchema.index({ reason: 1, createdAt: -1 });

orderReturnSchema.index(
  { order: 1, idempotencyKey: 1 },
  {
    unique: true,
    partialFilterExpression: { idempotencyKey: { $type: "string" } },
  }
);

// ==================== Export Model ====================

module.exports = mongoose.model("OrderReturn", orderReturnSchema);