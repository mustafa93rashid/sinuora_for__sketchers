const ProductVariant = require("../models/productVariant.model");

const InventoryTransaction = require("../models/inventoryTransaction.model");

const inventoryHelper = require("../helpers/inventory.helper");

const { buildPagination, buildPaginationResponse } = require("../helpers/pagination.helper");

// ==================== Inventory Controller ====================

class InventoryController {

  // ==================== Get Inventory ====================

  getInventory = async (req, res) => {
    const { page = 1, limit = 20, product, color, size, isActive, lowStock } = req.query;

    // ==================== Build Filter ====================

    const filter = {};

    if (product) {
      filter.product = product;
    }

    if (color) {
      filter.color = color;
    }

    if (size !== undefined) {
      filter.size = size;
    }

    if (isActive !== undefined) {
      filter.isActive = isActive;
    }

    if (lowStock !== undefined) {
      filter.$expr = {
        $lte: [
          {
            $subtract: ["$stockQuantity", "$reservedQuantity"],
          },
          lowStock,
        ],
      };
    }

    // ==================== Pagination ====================

    const { skip } = buildPagination(page, limit);

    // ==================== Get Inventory ====================

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
      message: "Inventory retrieved successfully",
      results: variants.length,
      pagination: buildPaginationResponse(page, limit, totalVariants),
      data: {
        variants,
      },
    });
  };

  // ==================== Get Variant Inventory ====================

  getVariantInventory = async (req, res) => {
    const { variantId } = req.params;

    // ==================== Get Variant ====================

    const variant = await ProductVariant.findById(variantId).populate({
      path: "product",
      select: "name modelCode brand category images isActive",
    });

    // ==================== Check Variant ====================

    if (!variant) {
      return res.status(404).json({
        success: false,
        message: "Product variant not found",
      });
    }

    // ==================== Response ====================

    return res.status(200).json({
      success: true,
      message: "Variant inventory retrieved successfully",
      data: {
        variant,
      },
    });
  };

  // ==================== Add Stock ====================

  addStock = async (req, res) => {
    const { variantId } = req.params;

    const { quantity, reason, note } = req.body;

    // ==================== Add Stock ====================

    const variant = await inventoryHelper.addStock({
      variantId,
      quantity,
      reason,
      note,
      performedBy: req.user._id,
    });

    // ==================== Populate Product ====================

    await variant.populate({
      path: "product",
      select: "name modelCode brand category images isActive",
    });

    // ==================== Response ====================

    return res.status(200).json({
      success: true,
      message: "Stock added successfully",
      data: {
        variant,
      },
    });
  };

  // ==================== Adjust Stock ====================

  adjustStock = async (req, res) => {
    const { variantId } = req.params;

    const { newQuantity, reason, note } = req.body;

    // ==================== Adjust Stock ====================

    const variant = await inventoryHelper.adjustStock({
      variantId,
      newQuantity,
      reason,
      note,
      performedBy: req.user._id,
    });

    // ==================== Populate Product ====================

    await variant.populate({
      path: "product",
      select: "name modelCode brand category images isActive",
    });

    // ==================== Response ====================

    return res.status(200).json({
      success: true,
      message: "Stock adjusted successfully",
      data: {
        variant,
      },
    });
  };

  // ==================== Get Inventory Transactions ====================

  getInventoryTransactions = async (req, res) => {
    const { page = 1, limit = 20, variant, type, order, performedBy } = req.query;

    // ==================== Build Filter ====================

    const filter = {};

    if (variant) {
      filter.variant = variant;
    }

    if (type) {
      filter.type = type;
    }

    if (order) {
      filter.order = order;
    }

    if (performedBy) {
      filter.performedBy = performedBy;
    }

    // ==================== Pagination ====================

    const { skip } = buildPagination(page, limit);

    // ==================== Get Transactions ====================

    const [transactions, totalTransactions] = await Promise.all([
      InventoryTransaction.find(filter)
        .populate({
          path: "variant",
          select: "product color size sku stockQuantity reservedQuantity",
          populate: {
            path: "product",
            select: "name modelCode images",
          },
        })
        .populate({
          path: "performedBy",
          select: "fullName email role",
        })
        .populate({
          path: "order",
          select: "orderNumber status",
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),

      InventoryTransaction.countDocuments(filter),
    ]);

    // ==================== Response ====================

    return res.status(200).json({
      success: true,
      message: "Inventory transactions retrieved successfully",
      results: transactions.length,
      pagination: buildPaginationResponse(page, limit, totalTransactions),
      data: {
        transactions,
      },
    });
  };

  // ==================== Get Variant Transactions ====================

  getVariantTransactions = async (req, res) => {
    const { variantId } = req.params;

    const { page = 1, limit = 20 } = req.query;

    // ==================== Check Variant ====================

    const variant = await ProductVariant.findById(variantId);

    if (!variant) {
      return res.status(404).json({
        success: false,
        message: "Product variant not found",
      });
    }

    // ==================== Pagination ====================

    const { skip } = buildPagination(page, limit);

    // ==================== Get Transactions ====================

    const [transactions, totalTransactions] = await Promise.all([
      InventoryTransaction.find({
        variant: variantId,
      })
        .populate({
          path: "performedBy",
          select: "fullName email role",
        })
        .populate({
          path: "order",
          select: "orderNumber status",
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),

      InventoryTransaction.countDocuments({
        variant: variantId,
      }),
    ]);

    // ==================== Response ====================

    return res.status(200).json({
      success: true,
      message: "Variant inventory transactions retrieved successfully",
      results: transactions.length,
      pagination: buildPaginationResponse(page, limit, totalTransactions),
      data: {
        transactions,
      },
    });
  };
}

// ==================== Export Controller ====================

module.exports = new InventoryController();