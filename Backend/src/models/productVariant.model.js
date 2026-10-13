const mongoose = require("mongoose");

// ==================== Product Variant Schema ====================

const productVariantSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      index: true,
    },

    color: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50,
    },

    size: {
      type: Number,
      required: true,
      enum: [
        36,
        36.5,
        37,
        37.5,
        38,
        38.5,
        39,
        39.5,
        40,
        40.5,
        41,
        41.5,
        42,
      ],
    },

    sku: {
      type: String,
      trim: true,
      uppercase: true,
      unique: true,
      sparse: true,
      maxlength: 100,
    },

    stockQuantity: {
      type: Number,
      default: 0,
      min: 0,
    },

    reservedQuantity: {
      type: Number,
      default: 0,
      min: 0,
    },

    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
    },
    toObject: {
      virtuals: true,
    },
  },
);

// ==================== Available Quantity ====================

productVariantSchema.virtual(
  "availableQuantity",
).get(function () {
  return (
    this.stockQuantity -
    this.reservedQuantity
  );
});

// ==================== Validate Reserved Quantity ====================

productVariantSchema.pre("validate", function () {
  if (this.reservedQuantity > this.stockQuantity) {
    throw new Error(
      "Reserved quantity cannot exceed stock quantity"
    );
  }
});

// ==================== Product Color Size Unique Index ====================

productVariantSchema.index(
  {
    product: 1,
    color: 1,
    size: 1,
  },
  {
    unique: true,
  },
);

// ==================== Product Active Variants Index ====================

productVariantSchema.index({
  product: 1,
  isActive: 1,
});

// ==================== Model ====================

const ProductVariant = mongoose.model(
  "ProductVariant",
  productVariantSchema,
);

// ==================== Export ====================

module.exports = ProductVariant;