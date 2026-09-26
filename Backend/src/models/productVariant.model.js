const mongoose = require("mongoose");

// ==================== Product Variant Schema ====================

const productVariantSchema = new mongoose.Schema(
    {
        // ==================== Product ====================

        product: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Product",
            required: [
                true,
                "Product is required",
            ],
            index: true,
        },

        // ==================== Variant Information ====================

        color: {
            type: String,
            required: [
                true,
                "Color is required",
            ],
            trim: true,
            maxlength: [
                50,
                "Color cannot exceed 50 characters",
            ],
        },

        size: {
            type: Number,
            required: [
                true,
                "Size is required",
            ],
            enum: {
                values: [36, 36.5, 37, 37.5, 38, 38.5, 39, 39.5, 40, 40.5, 41, 41.5, 42],
                message: "Invalid shoe size",
            },
        },

        sku: {
            type: String,
            trim: true,
            uppercase: true,
            default: null,
        },

        // ==================== Inventory ====================

        stockQuantity: {
            type: Number,
            required: true,
            default: 0,
            min: [
                0,
                "Stock quantity cannot be negative",
            ],
        },

        reservedQuantity: {
            type: Number,
            required: true,
            default: 0,
            min: [
                0,
                "Reserved quantity cannot be negative",
            ],
        },

        // ==================== Status ====================

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

productVariantSchema.pre(
    "validate",
    function (next) {
        if (
            this.reservedQuantity >
            this.stockQuantity
        ) {
            return next(
                new Error(
                    "Reserved quantity cannot exceed stock quantity",
                ),
            );
        }

        next();
    },
);

// ==================== Unique Product + Color + Size ====================

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

// ==================== Unique SKU ====================

productVariantSchema.index(
    {
        sku: 1,
    },
    {
        unique: true,
        sparse: true,
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

module.exports = ProductVariant;