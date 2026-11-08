
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

// ==================== Common Validators ====================

const isNonNegativeInteger = (value) =>
  Number.isSafeInteger(value) && value >= 0;

const isPositiveInteger = (value) =>
  Number.isSafeInteger(value) && value > 0;

// ==================== Customer Schema ====================

const customerSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },

    phone: {
      type: String,
      trim: true,
      maxlength: 30,
    },

    instagramUsername: {
      type: String,
      trim: true,
      maxlength: 100,
    },

    governorate: {
      type: String,
      trim: true,
      maxlength: 100,
    },

    city: {
      type: String,
      trim: true,
      maxlength: 100,
    },

    address: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },
  },
  {
    _id: false,
  }
);

// ==================== Product Snapshot Schema ====================

const productSnapshotSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    modelCode: {
      type: String,
      trim: true,
    },

    color: {
      type: String,
      required: true,
      trim: true,
    },

    size: {
      type: Number,
      required: true,
    },

    sku: {
      type: String,
      trim: true,
    },
  },
  {
    _id: false,
  }
);

// ==================== Order Item Schema ====================

const orderItemSchema = new mongoose.Schema(
  {
    // ==================== Product References ====================

    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },

    variant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ProductVariant",
      required: true,
    },

    // ==================== Selling Information ====================

    quantity: {
      type: Number,
      required: true,
      min: 1,
      validate: {
        validator: isPositiveInteger,
        message: "Quantity must be a positive safe integer",
      },
    },

    unitPrice: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator: isNonNegativeInteger,
        message: "Unit price must be a non-negative safe integer",
      },
    },

    totalPrice: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator: isNonNegativeInteger,
        message: "Total price must be a non-negative safe integer",
      },
    },

    // ==================== Historical Cost Snapshot ====================

    unitCost: {
      type: Number,
      default: null,
      min: 0,
      validate: {
        validator: (value) =>
          value === null || isNonNegativeInteger(value),
        message: "Unit cost must be a non-negative safe integer",
      },
    },

    totalCost: {
      type: Number,
      default: null,
      min: 0,
      validate: {
        validator: (value) =>
          value === null || isNonNegativeInteger(value),
        message: "Total cost must be a non-negative safe integer",
      },
    },

    // ==================== Item Quantities ====================

    dispatchedQuantity: {
      type: Number,
      default: 0,
      min: 0,
      validate: {
        validator: isNonNegativeInteger,
        message: "Invalid dispatched quantity",
      },
    },

    deliveredQuantity: {
      type: Number,
      default: 0,
      min: 0,
      validate: {
        validator: isNonNegativeInteger,
        message: "Invalid delivered quantity",
      },
    },

    returnedQuantity: {
      type: Number,
      default: 0,
      min: 0,
      validate: {
        validator: isNonNegativeInteger,
        message: "Invalid returned quantity",
      },
    },

    cancelledQuantity: {
      type: Number,
      default: 0,
      min: 0,
      validate: {
        validator: isNonNegativeInteger,
        message: "Invalid cancelled quantity",
      },
    },

    // ==================== Product Snapshot ====================

    productSnapshot: {
      type: productSnapshotSchema,
      required: true,
    },
  },
  {
    _id: true,
  }
);

// ==================== Order Schema ====================

const orderSchema = new mongoose.Schema(
  {
    // ==================== Order Information ====================

    orderNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
    },

    customer: {
      type: customerSchema,
      required: true,
    },

    items: {
      type: [orderItemSchema],
      required: true,
      validate: {
        validator: (items) =>
          Array.isArray(items) &&
          items.length >= 1 &&
          items.length <= 100,
        message: "Order must contain between 1 and 100 items",
      },
    },

    status: {
      type: String,
      enum: ORDER_STATUSES,
      default: "New",
      index: true,
    },

    // ==================== Order Amounts ====================

    subtotal: {
      type: Number,
      required: true,
      min: 0,
    },

    deliveryFee: {
      type: Number,
      default: 0,
      min: 0,
    },

    discount: {
      type: Number,
      default: 0,
      min: 0,
    },

    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },

    deliveredAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

    returnedAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

    // ==================== Order Users ====================

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    cancelledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    preparedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    dispatchedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    completedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    // ==================== Order Dates ====================

    preparedAt: {
      type: Date,
      default: null,
    },

    dispatchedAt: {
      type: Date,
      default: null,
    },

    completedAt: {
      type: Date,
      default: null,
    },

    cancelledAt: {
      type: Date,
      default: null,
    },

    // ==================== Follow-up Status ====================

    followUpCompleted: {
      type: Boolean,
      default: false,
      index: true,
    },

    // ==================== Order Notes ====================

    notes: {
      type: String,
      trim: true,
      maxlength: 1000,
    },

    // ==================== Idempotency ====================

    idempotencyKey: {
      type: String,
      trim: true,
    },

    idempotencyHash: {
      type: String,
    },
  },
  {
    timestamps: true,
    optimisticConcurrency: true,
  }
);

// ==================== Order Item Validation ====================

orderItemSchema.pre("validate", function () {
  // ==================== Validate Quantities ====================

  const quantities = [
    this.quantity,
    this.dispatchedQuantity,
    this.deliveredQuantity,
    this.returnedQuantity,
    this.cancelledQuantity,
  ];

  if (
    !isPositiveInteger(this.quantity) ||
    !quantities.every(isNonNegativeInteger)
  ) {
    this.invalidate(
      "quantity",
      "Order item quantities must be valid integers"
    );

    return;
  }

  // ==================== Validate Dispatched Quantity ====================

  if (this.dispatchedQuantity > this.quantity) {
    this.invalidate(
      "dispatchedQuantity",
      "Dispatched quantity exceeds ordered quantity"
    );
  }

  // ==================== Validate Delivered And Returned ====================

  if (
    this.deliveredQuantity + this.returnedQuantity >
    this.dispatchedQuantity
  ) {
    this.invalidate(
      "returnedQuantity",
      "Delivered and returned quantities exceed dispatched quantity"
    );
  }

  // ==================== Validate Cancelled Quantity ====================

  if (
    this.dispatchedQuantity + this.cancelledQuantity >
    this.quantity
  ) {
    this.invalidate(
      "cancelledQuantity",
      "Dispatched and cancelled quantities exceed ordered quantity"
    );
  }

  // ==================== Validate Selling Amount ====================

  const calculatedTotalPrice =
    this.quantity * this.unitPrice;

  if (
    !isNonNegativeInteger(this.unitPrice) ||
    !isNonNegativeInteger(this.totalPrice) ||
    !Number.isSafeInteger(calculatedTotalPrice) ||
    this.totalPrice !== calculatedTotalPrice
  ) {
    this.invalidate(
      "totalPrice",
      "Item total price does not match quantity and unit price"
    );
  }

  // ==================== Validate Historical Cost ====================

  const hasUnitCost =
    this.unitCost !== undefined &&
    this.unitCost !== null;

  const hasTotalCost =
    this.totalCost !== undefined &&
    this.totalCost !== null;

  if (hasUnitCost !== hasTotalCost) {
    this.invalidate(
      "totalCost",
      "Unit cost and total cost must be provided together"
    );

    return;
  }

  // ==================== Validate Known Cost ====================

  if (hasUnitCost && hasTotalCost) {
    const calculatedTotalCost =
      this.quantity * this.unitCost;

    if (
      !isNonNegativeInteger(this.unitCost) ||
      !isNonNegativeInteger(this.totalCost) ||
      !Number.isSafeInteger(calculatedTotalCost) ||
      this.totalCost !== calculatedTotalCost
    ) {
      this.invalidate(
        "totalCost",
        "Item total cost does not match quantity and unit cost"
      );
    }
  }
});

// ==================== Order Validation ====================

orderSchema.pre("validate", function () {
  // ==================== Customer Validation ====================

  const phone =
    typeof this.customer?.phone === "string"
      ? this.customer.phone.trim()
      : "";

  const instagram =
    typeof this.customer?.instagramUsername === "string"
      ? this.customer.instagramUsername.trim()
      : "";

  if (!phone && !instagram) {
    this.invalidate(
      "customer",
      "Customer phone or Instagram username is required"
    );
  }

  // ==================== Validate Duplicate Variants ====================

  const variants = new Set();

  for (const item of this.items || []) {
    const variantId = String(item.variant);

    if (variants.has(variantId)) {
      this.invalidate(
        "items",
        "Duplicate product variant in order"
      );
    }

    variants.add(variantId);
  }

  // ==================== Validate Order Amounts ====================

  const amountFields = [
    "subtotal",
    "deliveryFee",
    "discount",
    "totalAmount",
    "deliveredAmount",
    "returnedAmount",
  ];

  for (const field of amountFields) {
    if (!isNonNegativeInteger(this[field])) {
      this.invalidate(
        field,
        "Amount must be a non-negative safe integer"
      );
    }
  }

  // ==================== Validate Subtotal ====================

  const calculatedSubtotal = (this.items || []).reduce(
    (sum, item) => sum + item.totalPrice,
    0
  );

  if (
    !isNonNegativeInteger(calculatedSubtotal) ||
    this.subtotal !== calculatedSubtotal
  ) {
    this.invalidate(
      "subtotal",
      "Subtotal does not match order items"
    );
  }

  // ==================== Validate Total Amount ====================

  const beforeDiscount =
    this.subtotal + this.deliveryFee;

  const calculatedTotal =
    beforeDiscount - this.discount;

  if (
    !isNonNegativeInteger(beforeDiscount) ||
    this.discount > beforeDiscount ||
    !isNonNegativeInteger(calculatedTotal) ||
    this.totalAmount !== calculatedTotal
  ) {
    this.invalidate(
      "totalAmount",
      "Invalid order total amount"
    );
  }

  // ==================== Validate Delivered Amount ====================

  const calculatedDeliveredAmount = (this.items || []).reduce(
    (sum, item) =>
      sum + item.deliveredQuantity * item.unitPrice,
    0
  );

  if (
    !isNonNegativeInteger(calculatedDeliveredAmount) ||
    this.deliveredAmount !== calculatedDeliveredAmount
  ) {
    this.invalidate(
      "deliveredAmount",
      "Delivered amount does not match delivered items"
    );
  }

  // ==================== Validate Returned Amount ====================

  const calculatedReturnedAmount = (this.items || []).reduce(
    (sum, item) =>
      sum + item.returnedQuantity * item.unitPrice,
    0
  );

  if (
    !isNonNegativeInteger(calculatedReturnedAmount) ||
    this.returnedAmount !== calculatedReturnedAmount
  ) {
    this.invalidate(
      "returnedAmount",
      "Returned amount does not match returned items"
    );
  }

  // ==================== Calculate Pending Quantity ====================

  const remainingQuantity = (this.items || []).reduce(
    (sum, item) =>
      sum +
      item.dispatchedQuantity -
      item.deliveredQuantity -
      item.returnedQuantity,
    0
  );

  // ==================== Validate Follow-up Completion ====================

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
    this.invalidate(
      "followUpCompleted",
      "Cannot complete follow-up while items remain unresolved"
    );
  }

  // ==================== Validate Final Status ====================

  if (
    ["Delivered", "Returned"].includes(this.status) &&
    !this.followUpCompleted
  ) {
    this.invalidate(
      "followUpCompleted",
      "Final order status requires completed follow-up"
    );
  }

  // ==================== Validate Delivered Status ====================

  if (
    this.status === "Delivered" &&
    (this.items || []).some(
      (item) =>
        item.deliveredQuantity !== item.dispatchedQuantity ||
        item.returnedQuantity !== 0
    )
  ) {
    this.invalidate(
      "status",
      "Delivered order must have all dispatched items delivered"
    );
  }

  // ==================== Validate Returned Status ====================

  if (
    this.status === "Returned" &&
    (this.items || []).some(
      (item) =>
        item.returnedQuantity !== item.dispatchedQuantity ||
        item.deliveredQuantity !== 0
    )
  ) {
    this.invalidate(
      "status",
      "Returned order must have all dispatched items returned"
    );
  }

  // ==================== Validate Cancelled Status ====================

  if (
    this.status === "Cancelled" &&
    (this.items || []).some(
      (item) =>
        item.cancelledQuantity !== item.quantity ||
        item.dispatchedQuantity !== 0
    )
  ) {
    this.invalidate(
      "status",
      "Cancelled order must have all items cancelled"
    );
  }
});

// ==================== Order Indexes ====================

orderSchema.index({
  status: 1,
  createdAt: -1,
});

orderSchema.index({
  createdBy: 1,
  createdAt: -1,
});

orderSchema.index({
  createdAt: -1,
});

orderSchema.index({
  followUpCompleted: 1,
  status: 1,
  createdAt: -1,
});

// ==================== Order Idempotency Index ====================

orderSchema.index(
  {
    createdBy: 1,
    idempotencyKey: 1,
  },
  {
    unique: true,
    partialFilterExpression: {
      idempotencyKey: {
        $type: "string",
      },
    },
  }
);

// ==================== Export Model ====================

module.exports = mongoose.model("Order", orderSchema);
