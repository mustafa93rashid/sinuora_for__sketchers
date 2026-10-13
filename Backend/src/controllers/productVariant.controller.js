const Product = require("../models/product.model");

const ProductVariant = require("../models/productVariant.model");

const { buildPagination, buildPaginationResponse } = require("../helpers/pagination.helper");

const { escapeRegex } = require("../helpers/search.helper");

// ==================== Product Variant Controller ====================

class ProductVariantController {

  // ==================== Create Product Variant ====================

  createProductVariant = async (req, res) => {
    const { product, color, size, sku } = req.body;

    const existingProduct = await Product.findById(product);

    if (!existingProduct) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    if (!existingProduct.isActive) {
      return res.status(400).json({
        success: false,
        message: "Cannot create a variant for an inactive product",
      });
    }

    const existingVariant = await ProductVariant.findOne({
      product: existingProduct._id,
      color,
      size,
    });

    if (existingVariant) {
      return res.status(409).json({
        success: false,
        message: "This product variant already exists",
      });
    }

    if (sku) {
      const existingSku = await ProductVariant.findOne({ sku });

      if (existingSku) {
        return res.status(409).json({
          success: false,
          message: `SKU ${sku} is already in use`,
        });
      }
    }

    const variant = await ProductVariant.create({
      product: existingProduct._id,
      color,
      size,
      ...(sku && { sku }),
    });

    await variant.populate({
      path: "product",
      select: "name modelCode brand category images isActive",
    });

    return res.status(201).json({
      success: true,
      message: "Product variant created successfully",
      data: {
        variant,
      },
    });
  };

  // ==================== Get Product Variants ====================

  getProductVariants = async (req, res) => {
    const { page = 1, limit = 20, product, color, size, isActive } = req.query;

    // ==================== Build Filter ====================

    const filter = {};

    if (product) {
      filter.product = product;
    }

    if (color) {
      filter.color = {
        $regex: `^${escapeRegex(color)}$`,
        $options: "i",
      };
    }

    if (size !== undefined) {
      filter.size = size;
    }

    if (isActive !== undefined) {
      filter.isActive = isActive;
    }

    // ==================== Pagination ====================

    const { skip } = buildPagination(page, limit);

    // ==================== Get Variants ====================

    const [variants, totalVariants] = await Promise.all([
      ProductVariant.find(filter)
        .populate({
          path: "product",
          select: "name modelCode brand category images isActive",
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),

      ProductVariant.countDocuments(filter),
    ]);

    // ==================== Response ====================

    return res.status(200).json({
      success: true,
      message: "Product variants retrieved successfully",
      results: variants.length,
      pagination: buildPaginationResponse(page, limit, totalVariants),
      data: {
        variants,
      },
    });
  };

  // ==================== Get Variants By Product ====================

  getVariantsByProduct = async (req, res) => {
    const { productId } = req.params;

    const product = await Product.findById(productId);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    const variants = await ProductVariant.find({
      product: productId,
    })
      .populate({
        path: "product",
        select: "name modelCode brand category images isActive",
      })
      .sort({
        color: 1,
        size: 1,
      });


    return res.status(200).json({
      success: true,
      message: "Product variants retrieved successfully",
      results: variants.length,
      data: {
        variants,
      },
    });
  };

  // ==================== Get Product Variant By Id ====================

  getProductVariantById = async (req, res) => {
    const { id } = req.params;

    const variant = await ProductVariant.findById(id).populate({
      path: "product",
      select: "name modelCode brand category images isActive",
    });

    if (!variant) {
      return res.status(404).json({
        success: false,
        message: "Product variant not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Product variant retrieved successfully",
      data: {
        variant,
      },
    });
  };

  // ==================== Update Product Variant ====================

  updateProductVariant = async (req, res) => {
    const { id } = req.params;

    const { color, size, sku } = req.body;

    const variant = await ProductVariant.findById(id);

    if (!variant) {
      return res.status(404).json({
        success: false,
        message: "Product variant not found",
      });
    }

    const updatedColor = color !== undefined ? color : variant.color;

    const updatedSize = size !== undefined ? size : variant.size;

    if (color !== undefined || size !== undefined) {
      const existingVariant = await ProductVariant.findOne({
        _id: {
          $ne: variant._id,
        },
        product: variant.product,
        color: updatedColor,
        size: updatedSize,
      });

      if (existingVariant) {
        return res.status(409).json({
          success: false,
          message: "This product variant already exists",
        });
      }
    }

    if (sku !== undefined) {
      const existingSku = await ProductVariant.findOne({
        _id: {
          $ne: variant._id,
        },
        sku,
      });

      if (existingSku) {
        return res.status(409).json({
          success: false,
          message: `SKU ${sku} is already in use`,
        });
      }

      variant.sku = sku;
    }

    if (color !== undefined) {
      variant.color = color;
    }

    if (size !== undefined) {
      variant.size = size;
    }

    await variant.save();

    await variant.populate({
      path: "product",
      select: "name modelCode brand category images isActive",
    });


    return res.status(200).json({
      success: true,
      message: "Product variant updated successfully",
      data: {variant},
    });
  };

  // ==================== Archive Product Variant ====================

  archiveProductVariant = async (req, res) => {
    const { id } = req.params;

    const variant = await ProductVariant.findById(id);

    if (!variant) {
      return res.status(404).json({
        success: false,
        message: "Product variant not found",
      });
    }

    if (!variant.isActive) {
      return res.status(400).json({
        success: false,
        message: "Product variant is already archived",
      });
    }

    if (variant.reservedQuantity > 0) {
      return res.status(409).json({
        success: false,
        message: "Cannot archive a variant with reserved stock",
      });
    }

    variant.isActive = false;

    await variant.save();

    return res.status(200).json({
      success: true,
      message: "Product variant archived successfully",
    });
  };

  // ==================== Restore Product Variant ====================

  restoreProductVariant = async (req, res) => {
    const { id } = req.params;

    const variant = await ProductVariant.findById(id);

    if (!variant) {
      return res.status(404).json({
        success: false,
        message: "Product variant not found",
      });
    }

    if (variant.isActive) {
      return res.status(400).json({
        success: false,
        message: "Product variant is already active",
      });
    }

    const product = await Product.findById(variant.product);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    if (!product.isActive) {
      return res.status(400).json({
        success: false,
        message: "Cannot restore a variant while its product is inactive",
      });
    }

    variant.isActive = true;

    await variant.save();

    await variant.populate({
      path: "product",
      select: "name modelCode brand category images isActive",
    });


    return res.status(200).json({
      success: true,
      message: "Product variant restored successfully",
      data: {variant},
    });
  };
}

module.exports = new ProductVariantController();