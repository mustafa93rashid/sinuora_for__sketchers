const catalog = require("../helpers/catalog.helper");
const Product = require("../models/product.model");

const ProductVariant = require("../models/productVariant.model");

const { buildPagination, buildPaginationResponse } = require("../helpers/pagination.helper");

const { escapeRegex } = require("../helpers/search.helper");

// ==================== Product Variant Controller ====================

class ProductVariantController {

  // ==================== Create Product Variant ====================

  createProductVariant = async (req, res) => {
    const { product, color, size, sku } = req.body;
    const variant = await catalog.createVariant({ product, color, size, ...(sku && { sku }) });
    await variant.populate("product", "name modelCode brand category images isActive");
    return res.status(201).json({ success: true, data: { variant } });
  };

  // ==================== Get Product Variants ====================

  getProductVariants = async (req, res) => {
    const { page = 1, limit = 20, product, color, size, isActive } = (req.validatedQuery || {});

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
    const { color, size, sku } = req.body;
    const variant = await catalog.updateVariant(req.params.id, { color, size, sku });
    await variant.populate("product", "name modelCode brand category images isActive");
    return res.json({ success: true, data: { variant } });
  };

  // ==================== Archive Product Variant ====================

  archiveProductVariant = async (req, res) => {
    const variant = await catalog.setVariantActive(req.params.id, false);
    return res.json({ success: true, data: { variant } });
  };

  // ==================== Restore Product Variant ====================

  restoreProductVariant = async (req, res) => {
    const variant = await catalog.setVariantActive(req.params.id, true);
    return res.json({ success: true, data: { variant } });
  };
}

module.exports = new ProductVariantController();