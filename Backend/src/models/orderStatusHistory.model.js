const mongoose = require("mongoose");

// ==================== Order Status Constants ====================

const ORDER_STATUSES = [
  "New",
  "Preparing",
  "Prepared",
  "Out For Delivery",
  "Delivered",
  "Returned",
  "Partially Returned",
  "Cancelled",
];

// ==================== Order Status History Schema ====================

const orderStatusHistorySchema = new mongoose.Schema({
  order: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true, index: true },

  fromStatus: { type: String, enum: ORDER_STATUSES, default: null },
  toStatus: { type: String, enum: ORDER_STATUSES, required: true },

  changedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },

  reason: { type: String, trim: true, maxlength: 500 },
  note: { type: String, trim: true, maxlength: 1000 },
}, { timestamps: true });

// ==================== Order Status History Indexes ====================

orderStatusHistorySchema.index({ order: 1, createdAt: 1 });
orderStatusHistorySchema.index({ changedBy: 1, createdAt: -1 });
orderStatusHistorySchema.index({ toStatus: 1, createdAt: -1 });

// ==================== Export Model ====================

module.exports = mongoose.model("OrderStatusHistory", orderStatusHistorySchema);