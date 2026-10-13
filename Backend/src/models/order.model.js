
const mongoose = require("mongoose");

// ==================== Order Statuses ====================

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

// ==================== Customer Schema ====================

const customerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    phone: { type: String, trim: true, maxlength: 30 },
    instagramUsername: { type: String, trim: true, maxlength: 100 },
    governorate: { type: String, trim: true, maxlength: 100 },
    city: { type: String, trim: true, maxlength: 100 },
    address: { type: String, required: true, trim: true, maxlength: 500 },
  },
  { _id: false }
);

// ==================== Product Snapshot Schema ====================

const productSnapshotSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    modelCode: { type: String },
    color: { type: String, required: true },
    size: { type: Number, required: true },
    sku: { type: String },
  },
  { _id: false }
);

// ==================== Order Item Schema ====================

const orderItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    variant: { type: mongoose.Schema.Types.ObjectId, ref: "ProductVariant", required: true },

    quantity: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true, min: 0 },
    totalPrice: { type: Number, required: true, min: 0 },

    dispatchedQuantity: { type: Number, default: 0, min: 0 },
    deliveredQuantity: { type: Number, default: 0, min: 0 },
    returnedQuantity: { type: Number, default: 0, min: 0 },
    cancelledQuantity: { type: Number, default: 0, min: 0 },

    productSnapshot: { type: productSnapshotSchema, required: true },
  },
  { _id: true }
);

// ==================== Order Schema ====================

const orderSchema = new mongoose.Schema(
  {
    orderNumber: { type: String, required: true, unique: true, trim: true, uppercase: true },

    customer: { type: customerSchema, required: true },

    items: {
      type: [orderItemSchema],
      required: true,
      validate: {
        validator: (items) => items.length > 0 && items.length <= 100,
        message: "Order must contain at least one item",
      },
    },

    status: { type: String, enum: ORDER_STATUSES, default: "New", index: true },

    // ==================== Order Amounts ====================

    subtotal: { type: Number, required: true, min: 0 },
    deliveryFee: { type: Number, default: 0, min: 0 },
    discount: { type: Number, default: 0, min: 0 },
    totalAmount: { type: Number, required: true, min: 0 },

    deliveredAmount: { type: Number, default: 0, min: 0 },
    returnedAmount: { type: Number, default: 0, min: 0 },

    // ==================== Order Users ====================

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    preparedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    dispatchedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    completedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },

    // ==================== Order Dates ====================

    preparedAt: { type: Date, default: null },
    dispatchedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    cancelledAt: { type: Date, default: null },

    // ==================== Follow-up Status ====================

    followUpCompleted: { type: Boolean, default: false, index: true },

    // ==================== Order Notes ====================

    notes: { type: String, trim: true, maxlength: 1000 },

    // ==================== Idempotency ====================

    idempotencyKey: { type: String, trim: true },
    idempotencyHash: { type: String },
  },
  { timestamps: true, optimisticConcurrency: true }
);

// ==================== Order Item Validation ====================

orderItemSchema.pre("validate", function () {
  const quantities = [
    this.quantity,
    this.dispatchedQuantity,
    this.deliveredQuantity,
    this.returnedQuantity,
    this.cancelledQuantity,
  ];

  if (!quantities.every((value) => Number.isSafeInteger(value) && value >= 0)) {
    this.invalidate("quantity", "Order item quantities must be non-negative integers");
    return;
  }

  if (this.dispatchedQuantity > this.quantity) {
    this.invalidate("dispatchedQuantity", "Dispatched quantity exceeds ordered quantity");
  }

  if (this.deliveredQuantity + this.returnedQuantity > this.dispatchedQuantity) {
    this.invalidate("returnedQuantity", "Delivered and returned quantities exceed dispatched quantity");
  }

  if (this.dispatchedQuantity + this.cancelledQuantity > this.quantity) {
    this.invalidate("cancelledQuantity", "Dispatched and cancelled quantities exceed ordered quantity");
  }
});

// ==================== Order Invariants ====================

orderSchema.pre("validate", function () {
  if (!this.customer?.phone && !this.customer?.instagramUsername) this.invalidate("customer", "Phone or Instagram username is required");
  const seen = new Set();
  for (const item of this.items) {
    if (seen.has(String(item.variant))) this.invalidate("items", "Duplicate variant");
    seen.add(String(item.variant));
    if (![item.unitPrice, item.totalPrice].every((n) => Number.isSafeInteger(n) && n >= 0) || item.totalPrice !== item.quantity * item.unitPrice) this.invalidate("items", "Invalid item amount");
  }
  for (const field of ["subtotal", "deliveryFee", "discount", "totalAmount", "deliveredAmount", "returnedAmount"]) {
    if (!Number.isSafeInteger(this[field]) || this[field] < 0) this.invalidate(field, "Amount must be a non-negative safe integer");
  }
  if (!Number.isSafeInteger(this.subtotal + this.deliveryFee) || this.discount > this.subtotal + this.deliveryFee || this.totalAmount !== this.subtotal + this.deliveryFee - this.discount) this.invalidate("totalAmount", "Invalid total amount");
});

// ==================== Order Indexes ====================

orderSchema.index({ status: 1, createdAt: -1 });
orderSchema.index({ createdBy: 1, createdAt: -1 });
orderSchema.index({ createdAt: -1 });
orderSchema.index({ followUpCompleted: 1, status: 1, createdAt: -1 });

orderSchema.index(
  { createdBy: 1, idempotencyKey: 1 },
  {
    unique: true,
    partialFilterExpression: { idempotencyKey: { $type: "string" } },
  }
);

// ==================== Export Model ====================

module.exports = mongoose.model("Order", orderSchema);
