
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

    // ==================== Selling Price ====================

    quantity: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true, min: 0 },
    totalPrice: { type: Number, required: true, min: 0 },

    // ==================== Cost Price ====================

    unitCost: { type: Number, min: 0 },
    totalCost: { type: Number, min: 0 },

    // ==================== Item Quantities ====================

    dispatchedQuantity: { type: Number, default: 0, min: 0 },
    deliveredQuantity: { type: Number, default: 0, min: 0 },
    returnedQuantity: { type: Number, default: 0, min: 0 },
    cancelledQuantity: { type: Number, default: 0, min: 0 },

    // ==================== Product Snapshot ====================

    productSnapshot: { type: productSnapshotSchema, required: true },
  },
  { _id: true }
);

// ==================== Order Schema ====================

const orderSchema = new mongoose.Schema(
  {
    // ==================== Order Information ====================

    orderNumber: { type: String, required: true, unique: true, trim: true, uppercase: true },

    customer: { type: customerSchema, required: true },

    items: {
      type: [orderItemSchema],
      required: true,
      validate: {
        validator: (items) => Array.isArray(items) && items.length > 0 && items.length <= 100,
        message: "Order must contain between 1 and 100 items",
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
  {
    timestamps: true,
    optimisticConcurrency: true,
  }
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

  // ==================== Item Selling Amount Validation ====================

  if (
    !Number.isSafeInteger(this.unitPrice) ||
    this.unitPrice < 0 ||
    !Number.isSafeInteger(this.totalPrice) ||
    this.totalPrice !== this.quantity * this.unitPrice
  ) {
    this.invalidate("totalPrice", "Invalid item selling amount");
  }

  // ==================== Item Cost Validation ====================

  const hasUnitCost = this.unitCost !== undefined && this.unitCost !== null;
  const hasTotalCost = this.totalCost !== undefined && this.totalCost !== null;

  if (hasUnitCost !== hasTotalCost) {
    this.invalidate("totalCost", "Unit cost and total cost must be provided together");
  }

  if (hasUnitCost && hasTotalCost) {
    if (
      !Number.isSafeInteger(this.unitCost) ||
      this.unitCost < 0 ||
      !Number.isSafeInteger(this.totalCost) ||
      this.totalCost !== this.quantity * this.unitCost
    ) {
      this.invalidate("totalCost", "Invalid item cost");
    }
  }
});

// ==================== Order Invariants ====================

orderSchema.pre("validate", function () {
  // ==================== Customer Validation ====================

  const phone = typeof this.customer?.phone === "string" ? this.customer.phone.trim() : "";
  const instagram = typeof this.customer?.instagramUsername === "string" ? this.customer.instagramUsername.trim() : "";

  if (!phone && !instagram) {
    this.invalidate("customer", "Phone or Instagram username is required");
  }

  // ==================== Duplicate Variants Validation ====================

  const seen = new Set();

  for (const item of this.items) {
    const variantId = String(item.variant);

    if (seen.has(variantId)) {
      this.invalidate("items", "Duplicate variant");
    }

    seen.add(variantId);
  }

  // ==================== Order Amount Validation ====================

  const amountFields = [
    "subtotal",
    "deliveryFee",
    "discount",
    "totalAmount",
    "deliveredAmount",
    "returnedAmount",
  ];

  for (const field of amountFields) {
    if (!Number.isSafeInteger(this[field]) || this[field] < 0) {
      this.invalidate(field, "Amount must be a non-negative safe integer");
    }
  }

  // ==================== Subtotal Validation ====================

  const calculatedSubtotal = this.items.reduce(
    (sum, item) => sum + item.totalPrice,
    0
  );

  if (
    !Number.isSafeInteger(calculatedSubtotal) ||
    this.subtotal !== calculatedSubtotal
  ) {
    this.invalidate("subtotal", "Subtotal does not match order items");
  }

  // ==================== Total Amount Validation ====================

  const beforeDiscount = this.subtotal + this.deliveryFee;
  const calculatedTotal = beforeDiscount - this.discount;

  if (
    !Number.isSafeInteger(beforeDiscount) ||
    this.discount > beforeDiscount ||
    !Number.isSafeInteger(calculatedTotal) ||
    this.totalAmount !== calculatedTotal
  ) {
    this.invalidate("totalAmount", "Invalid total amount");
  }

  // ==================== Delivered & Returned Amount Validation ====================

  const calculatedDeliveredAmount = this.items.reduce(
    (sum, item) => sum + item.deliveredQuantity * item.unitPrice,
    0
  );

  const calculatedReturnedAmount = this.items.reduce(
    (sum, item) => sum + item.returnedQuantity * item.unitPrice,
    0
  );

  if (
    !Number.isSafeInteger(calculatedDeliveredAmount) ||
    this.deliveredAmount !== calculatedDeliveredAmount
  ) {
    this.invalidate("deliveredAmount", "Delivered amount does not match delivered items");
  }

  if (
    !Number.isSafeInteger(calculatedReturnedAmount) ||
    this.returnedAmount !== calculatedReturnedAmount
  ) {
    this.invalidate("returnedAmount", "Returned amount does not match returned items");
  }

  // ==================== Follow-up Completion Validation ====================

  const remainingQuantity = this.items.reduce(
    (sum, item) =>
      sum + item.dispatchedQuantity - item.deliveredQuantity - item.returnedQuantity,
    0
  );

  const followUpStatuses = [
    "Out For Delivery",
    "Delivered",
    "Returned",
    "Partially Returned",
  ];

  if (
    followUpStatuses.includes(this.status) &&
    this.followUpCompleted &&
    remainingQuantity !== 0
  ) {
    this.invalidate("followUpCompleted", "Cannot complete follow-up while items remain unresolved");
  }

  if (
    ["Delivered", "Returned"].includes(this.status) &&
    !this.followUpCompleted
  ) {
    this.invalidate("followUpCompleted", "Final order status requires completed follow-up");
  }
});

// ==================== Order Indexes ====================

orderSchema.index({ status: 1, createdAt: -1 });
orderSchema.index({ createdBy: 1, createdAt: -1 });
orderSchema.index({ createdAt: -1 });
orderSchema.index({ followUpCompleted: 1, status: 1, createdAt: -1 });

// ==================== Order Idempotency Index ====================

orderSchema.index(
  { createdBy: 1, idempotencyKey: 1 },
  {
    unique: true,
    partialFilterExpression: {
      idempotencyKey: { $type: "string" },
    },
  }
);

// ==================== Export Model ====================

module.exports = mongoose.model("Order", orderSchema);
