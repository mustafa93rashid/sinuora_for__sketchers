const ProductVariant = require(
  "../models/productVariant.model",
);

const InventoryTransaction = require(
  "../models/inventoryTransaction.model",
);

const inventoryHelper = require(
  "../helper/inventory.helper",
);

// ==================== Inventory Controller ====================

class InventoryController {
  // ==================== Add Stock ====================

  addStock = async (req, res) => {
    const { variantId } = req.params;

    const {
      quantity,
      reason,
      note,
    } = req.body;

    const performedBy =
      req.user?._id || req.user?.id;

    // ==================== Add Stock ====================

    const result =
      await inventoryHelper.addStock({
        variantId,

        quantity,

        performedBy,

        reason:
          reason || "Stock added",

        note: note || "",
      });

    // ==================== Populate Variant ====================

    await result.variant.populate({
      path: "product",

      select:
        "name modelCode brand category images",
    });

    // ==================== Response ====================

    return res.status(200).json({
      success: true,

      message:
        "Stock added successfully",

      data: {
        variant: result.variant,

        transaction:
          result.transaction,
      },
    });
  };

  // ==================== Adjust Stock ====================

  adjustStock = async (req, res) => {
    const { variantId } = req.params;

    const {
      newQuantity,
      reason,
      note,
    } = req.body;

    const performedBy =
      req.user?._id || req.user?.id;

    // ==================== Adjust Stock ====================

    const result =
      await inventoryHelper.adjustStock({
        variantId,

        newQuantity,

        performedBy,

        reason,

        note: note || "",
      });

    // ==================== Populate Variant ====================

    await result.variant.populate({
      path: "product",

      select:
        "name modelCode brand category images",
    });

    // ==================== Response ====================

    return res.status(200).json({
      success: true,

      message:
        "Stock adjusted successfully",

      data: {
        variant: result.variant,

        transaction:
          result.transaction,
      },
    });
  };

  // ==================== Get Inventory ====================

  getInventory = async (req, res) => {
    const {
      page = 1,
      limit = 20,
      product,
      color,
      size,
      isActive,
      lowStock,
    } = req.query;

    const filter = {};

    // ==================== Product Filter ====================

    if (product) {
      filter.product = product;
    }

    // ==================== Color Filter ====================

    if (color) {
      filter.color = {
        $regex: `^${this.escapeRegex(
          color.trim(),
        )}$`,

        $options: "i",
      };
    }

    // ==================== Size Filter ====================

    if (size !== undefined) {
      filter.size = Number(size);
    }

    // ==================== Active Filter ====================

    if (isActive !== undefined) {
      filter.isActive =
        isActive === true ||
        isActive === "true";
    }

    // ==================== Low Stock Filter ====================

    if (lowStock !== undefined) {
      const lowStockNumber =
        Number(lowStock);

      if (
        Number.isFinite(
          lowStockNumber,
        ) &&
        lowStockNumber >= 0
      ) {
        filter.$expr = {
          $lte: [
            {
              $subtract: [
                "$stockQuantity",
                "$reservedQuantity",
              ],
            },

            lowStockNumber,
          ],
        };
      }
    }

    // ==================== Pagination ====================

    const pageNumber = Math.max(
      Number(page) || 1,
      1,
    );

    const limitNumber = Math.min(
      Math.max(
        Number(limit) || 20,
        1,
      ),

      100,
    );

    const skip =
      (pageNumber - 1) *
      limitNumber;

    // ==================== Get Inventory ====================

    const [
      variants,
      totalVariants,
    ] = await Promise.all([
      ProductVariant.find(filter)
        .populate({
          path: "product",

          select:
            "name modelCode brand category images isActive",
        })
        .sort({
          updatedAt: -1,
        })
        .skip(skip)
        .limit(limitNumber),

      ProductVariant.countDocuments(
        filter,
      ),
    ]);

    // ==================== Pagination ====================

    const totalPages = Math.ceil(
      totalVariants /
        limitNumber,
    );

    // ==================== Response ====================

    return res.status(200).json({
      success: true,

      results: variants.length,

      pagination: {
        page: pageNumber,

        limit: limitNumber,

        totalVariants,

        totalPages,

        hasNextPage:
          pageNumber <
          totalPages,

        hasPreviousPage:
          pageNumber > 1,
      },

      data: {
        variants,
      },
    });
  };

  // ==================== Get Variant Inventory ====================

  getVariantInventory = async (
    req,
    res,
  ) => {
    const { variantId } =
      req.params;

    // ==================== Get Variant ====================

    const variant =
      await ProductVariant.findById(
        variantId,
      ).populate({
        path: "product",

        select:
          "name modelCode brand category images isActive",
      });

    if (!variant) {
      return res.status(404).json({
        success: false,

        message:
          "Product variant not found",
      });
    }

    // ==================== Response ====================

    return res.status(200).json({
      success: true,

      data: {
        variant,
      },
    });
  };

  // ==================== Get Inventory Transactions ====================

  getInventoryTransactions = async (
    req,
    res,
  ) => {
    const {
      page = 1,
      limit = 20,
      variant,
      type,
      order,
      performedBy,
      startDate,
      endDate,
    } = req.query;

    const filter = {};

    // ==================== Variant Filter ====================

    if (variant) {
      filter.variant = variant;
    }

    // ==================== Type Filter ====================

    if (type) {
      filter.type =
        type.toUpperCase();
    }

    // ==================== Order Filter ====================

    if (order) {
      filter.order = order;
    }

    // ==================== User Filter ====================

    if (performedBy) {
      filter.performedBy =
        performedBy;
    }

    // ==================== Date Filter ====================

    if (startDate || endDate) {
      filter.createdAt = {};

      if (startDate) {
        filter.createdAt.$gte =
          new Date(startDate);
      }

      if (endDate) {
        const end =
          new Date(endDate);

        end.setHours(
          23,
          59,
          59,
          999,
        );

        filter.createdAt.$lte =
          end;
      }
    }

    // ==================== Pagination ====================

    const pageNumber = Math.max(
      Number(page) || 1,
      1,
    );

    const limitNumber = Math.min(
      Math.max(
        Number(limit) || 20,
        1,
      ),

      100,
    );

    const skip =
      (pageNumber - 1) *
      limitNumber;

    // ==================== Get Transactions ====================

    const [
      transactions,
      totalTransactions,
    ] = await Promise.all([
      InventoryTransaction.find(
        filter,
      )
        .populate({
          path: "variant",

          select:
            "color size sku stockQuantity reservedQuantity",

          populate: {
            path: "product",

            select:
              "name modelCode",
          },
        })
        .populate({
          path: "performedBy",

          select:
            "name email role",
        })
        .sort({
          createdAt: -1,
        })
        .skip(skip)
        .limit(limitNumber),

      InventoryTransaction.countDocuments(
        filter,
      ),
    ]);

    // ==================== Pagination ====================

    const totalPages = Math.ceil(
      totalTransactions /
        limitNumber,
    );

    // ==================== Response ====================

    return res.status(200).json({
      success: true,

      results:
        transactions.length,

      pagination: {
        page: pageNumber,

        limit: limitNumber,

        totalTransactions,

        totalPages,

        hasNextPage:
          pageNumber <
          totalPages,

        hasPreviousPage:
          pageNumber > 1,
      },

      data: {
        transactions,
      },
    });
  };

  // ==================== Get Variant Transactions ====================

  getVariantTransactions = async (
    req,
    res,
  ) => {
    const { variantId } =
      req.params;

    const {
      page = 1,
      limit = 20,
    } = req.query;

    // ==================== Check Variant ====================

    const variantExists =
      await ProductVariant.exists({
        _id: variantId,
      });

    if (!variantExists) {
      return res.status(404).json({
        success: false,

        message:
          "Product variant not found",
      });
    }

    // ==================== Pagination ====================

    const pageNumber = Math.max(
      Number(page) || 1,
      1,
    );

    const limitNumber = Math.min(
      Math.max(
        Number(limit) || 20,
        1,
      ),

      100,
    );

    const skip =
      (pageNumber - 1) *
      limitNumber;

    // ==================== Get Transactions ====================

    const [
      transactions,
      totalTransactions,
    ] = await Promise.all([
      InventoryTransaction.find({
        variant: variantId,
      })
        .populate({
          path: "performedBy",

          select:
            "name email role",
        })
        .sort({
          createdAt: -1,
        })
        .skip(skip)
        .limit(limitNumber),

      InventoryTransaction.countDocuments({
        variant: variantId,
      }),
    ]);

    const totalPages = Math.ceil(
      totalTransactions /
        limitNumber,
    );

    // ==================== Response ====================

    return res.status(200).json({
      success: true,

      results:
        transactions.length,

      pagination: {
        page: pageNumber,

        limit: limitNumber,

        totalTransactions,

        totalPages,

        hasNextPage:
          pageNumber <
          totalPages,

        hasPreviousPage:
          pageNumber > 1,
      },

      data: {
        transactions,
      },
    });
  };

  // ==================== Escape Regex ====================

  escapeRegex = (value) => {
    return value.replace(
      /[.*+?^${}()|[\]\\]/g,
      "\\$&",
    );
  };
}

// ==================== Export Controller ====================

module.exports =
  new InventoryController();