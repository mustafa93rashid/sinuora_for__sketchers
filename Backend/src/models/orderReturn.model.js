
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

// ==================== Return Types ====================

const RETURN_TYPES = ["FULL", "PARTIAL"];

// ==================== Common Validators ====================

const isNonNegativeInteger = (value) =>
  Number.isSafeInteger(value) && value >= 0;

const isPositiveInteger = (value) =>
  Number.isSafeInteger(value) && value > 0;

// ==================== Return Item Schema ====================

const returnItemSchema = new mongoose.Schema(
  {
    // ==================== Order Item Reference ====================

    orderItem: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },

    // ==================== Product Variant ====================

    variant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ProductVariant",
      required: true,
    },

    // ==================== Return Quantity ====================

    quantity: {
      type: Number,
      required: true,
      min: 1,
      validate: {
        validator: isPositiveInteger,
        message: "Return quantity must be a positive safe integer",
      },
    },

    // ==================== Selling Price Snapshot ====================

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

    // ==================== Return Classification ====================

    restockedQuantity: { type: Number, default: null, min: 0, validate: value => value === null || Number.isSafeInteger(value) },
    quarantinedQuantity: { type: Number, default: null, min: 0, validate: value => value === null || Number.isSafeInteger(value) },

    preDeliveryQuantity: {
      type: Number,
      default: null,
      min: 0,
      validate: {
        validator: (value) =>
          value === null || isNonNegativeInteger(value),
        message: "Invalid pre-delivery return quantity",
      },
    },

    postDeliveryQuantity: {
      type: Number,
      default: null,
      min: 0,
      validate: {
        validator: (value) =>
          value === null || isNonNegativeInteger(value),
        message: "Invalid post-delivery return quantity",
      },
    },
  },
  {
    _id: true,
  }
);

// ==================== Return Item Validation ====================

returnItemSchema.pre("validate", function () {
  if ((this.restockedQuantity !== null || this.quarantinedQuantity !== null) &&
      (!Number.isSafeInteger(this.restockedQuantity) || !Number.isSafeInteger(this.quarantinedQuantity) ||
       this.restockedQuantity + this.quarantinedQuantity !== this.quantity)) {
    this.invalidate("restockedQuantity", "Restocked and quarantined quantities must equal returned quantity");
  }
  // ==================== Validate Quantity ====================

  if (!isPositiveInteger(this.quantity)) {
    this.invalidate(
      "quantity",
      "Return quantity must be a positive safe integer"
    );
  }

  // ==================== Validate Selling Amount ====================

  const calculatedTotalPrice = this.quantity * this.unitPrice;

  if (
    !isNonNegativeInteger(this.unitPrice) ||
    !isNonNegativeInteger(this.totalPrice) ||
    !Number.isSafeInteger(calculatedTotalPrice) ||
    this.totalPrice !== calculatedTotalPrice
  ) {
    this.invalidate(
      "totalPrice",
      "Return total price must equal quantity multiplied by unit price"
    );
  }

  // ==================== Validate Return Classification ====================

  const hasPreDelivery =
    this.preDeliveryQuantity !== null &&
    this.preDeliveryQuantity !== undefined;

  const hasPostDelivery =
    this.postDeliveryQuantity !== null &&
    this.postDeliveryQuantity !== undefined;

  // ==================== Historical Return Compatibility ====================

  if (!hasPreDelivery && !hasPostDelivery) {
    return;
  }

  // ==================== Require Complete Classification ====================

  if (hasPreDelivery !== hasPostDelivery) {
    this.invalidate(
      "preDeliveryQuantity",
      "Both return classification quantities must be provided"
    );

    return;
  }

  // ==================== Validate Classification Quantities ====================

  if (
    !isNonNegativeInteger(this.preDeliveryQuantity) ||
    !isNonNegativeInteger(this.postDeliveryQuantity)
  ) {
    this.invalidate(
      "preDeliveryQuantity",
      "Return classification quantities must be non-negative integers"
    );

    return;
  }

  // ==================== Validate Classification Total ====================

  const classifiedQuantity =
    this.preDeliveryQuantity + this.postDeliveryQuantity;

  if (
    !Number.isSafeInteger(classifiedQuantity) ||
    classifiedQuantity !== this.quantity
  ) {
    this.invalidate(
      "postDeliveryQuantity",
      "Pre-delivery and post-delivery quantities must equal returned quantity"
    );
  }
});

// ==================== Order Return Schema ====================

const orderReturnSchema = new mongoose.Schema(
  {
    // ==================== Order Reference ====================

    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
      index: true,
    },

    // ==================== Returned Items ====================

    items: {
      type: [returnItemSchema],
      required: true,
      validate: {
        validator: (items) =>
          Array.isArray(items) &&
          items.length >= 1 &&
          items.length <= 100,
        message: "Return must contain between 1 and 100 items",
      },
    },

    // ==================== Return Type ====================

    type: {
      type: String,
      enum: RETURN_TYPES,
      required: true,
    },

    // ==================== Return Reason ====================

    reason: {
      type: String,
      enum: RETURN_REASONS,
      required: true,
    },

    // ==================== Return Note ====================

    note: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: "",
    },

    // ==================== Returned Amount ====================

    returnedAmount: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator: isNonNegativeInteger,
        message: "Returned amount must be a non-negative safe integer",
      },
    },

    // ==================== Return Processed By ====================

    processedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
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
  }
);

// ==================== Order Return Validation ====================

orderReturnSchema.pre("validate", function () {
  // ==================== Validate Return Items ====================

  if (
    !Array.isArray(this.items) ||
    this.items.length < 1 ||
    this.items.length > 100
  ) {
    this.invalidate(
      "items",
      "Return must contain between 1 and 100 items"
    );

    return;
  }

  // ==================== Prevent Duplicate Order Items ====================

  const orderItems = new Set();
  const variants = new Set();

  for (const item of this.items) {
    const orderItemId = String(item.orderItem);
    const variantId = String(item.variant);

    if (orderItems.has(orderItemId)) {
      this.invalidate(
        "items",
        "Duplicate order item in return"
      );
    }

    if (variants.has(variantId)) {
      this.invalidate(
        "items",
        "Duplicate product variant in return"
      );
    }

    orderItems.add(orderItemId);
    variants.add(variantId);
  }

  // ==================== Calculate Returned Amount ====================

  const calculatedReturnedAmount = this.items.reduce(
    (sum, item) => sum + item.totalPrice,
    0
  );

  // ==================== Validate Returned Amount ====================

  if (
    !isNonNegativeInteger(calculatedReturnedAmount) ||
    !isNonNegativeInteger(this.returnedAmount) ||
    this.returnedAmount !== calculatedReturnedAmount
  ) {
    this.invalidate(
      "returnedAmount",
      "Returned amount does not match returned items"
    );
  }

  // ==================== Validate Idempotency ====================

  const hasKey =
    typeof this.idempotencyKey === "string" &&
    this.idempotencyKey.trim().length > 0;

  const hasHash =
    typeof this.idempotencyHash === "string" &&
    this.idempotencyHash.trim().length > 0;

  if (hasKey !== hasHash) {
    this.invalidate(
      "idempotencyKey",
      "Idempotency key and hash must be provided together"
    );
  }

  if (hasKey) {
    if (!/^[A-Za-z0-9_-]{8,128}$/.test(this.idempotencyKey)) {
      this.invalidate(
        "idempotencyKey",
        "Invalid idempotency key"
      );
    }

    if (!/^[a-f0-9]{64}$/i.test(this.idempotencyHash)) {
      this.invalidate(
        "idempotencyHash",
        "Invalid idempotency hash"
      );
    }
  }
});

// ==================== Order Return Indexes ====================

orderReturnSchema.index({
  order: 1,
  createdAt: -1,
});

orderReturnSchema.index({
  processedBy: 1,
  createdAt: -1,
});

orderReturnSchema.index({
  reason: 1,
  createdAt: -1,
});

// ==================== Return Idempotency Index ====================

orderReturnSchema.index(
  {
    order: 1,
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

module.exports = mongoose.model("OrderReturn", orderReturnSchema);
