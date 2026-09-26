const Product = require(
  "../models/product.model",
);

const ProductVariant = require(
  "../models/productVariant.model",
);

// ==================== Product Variant Controller ====================

class ProductVariantController {
  // ==================== Create Product Variant ====================

  createProductVariant = async (req, res) => {
    const {
      product,
      color,
      size,
      sku,
    } = req.body;

    // ==================== Check Product ====================

    const existingProduct =
      await Product.findById(product);

    if (!existingProduct) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    // ==================== Check Product Status ====================

    if (!existingProduct.isActive) {
      return res.status(400).json({
        success: false,
        message:
          "Cannot create a variant for an inactive product",
      });
    }

    // ==================== Normalize Values ====================

    const normalizedColor =
      color.trim();

    const normalizedSku =
      sku?.trim().toUpperCase();

    // ==================== Check Existing Variant ====================

    const existingVariant =
      await ProductVariant.findOne({
        product: existingProduct._id,
        color: normalizedColor,
        size,
      });

    if (existingVariant) {
      return res.status(409).json({
        success: false,
        message:
          "This product variant already exists",
      });
    }

    // ==================== Check SKU ====================

    if (normalizedSku) {
      const existingSku =
        await ProductVariant.findOne({
          sku: normalizedSku,
        });

      if (existingSku) {
        return res.status(409).json({
          success: false,
          message:
            "This SKU is already in use",
        });
      }
    }

    // ==================== Create Variant ====================

    const variant =
      await ProductVariant.create({
        product: existingProduct._id,

        color: normalizedColor,

        size,

        ...(normalizedSku && {
          sku: normalizedSku,
        }),
      });

    // ==================== Populate Product ====================

    await variant.populate({
      path: "product",
      select:
        "name modelCode brand category images isActive",
    });

    // ==================== Response ====================

    return res.status(201).json({
      success: true,
      message:
        "Product variant created successfully",

      data: {
        variant,
      },
    });
  };

  // ==================== Get All Product Variants ====================

  getProductVariants = async (
    req,
    res,
  ) => {
    const {
      page = 1,
      limit = 20,
      product,
      color,
      size,
      isActive,
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

    // ==================== Status Filter ====================

    if (isActive !== undefined) {
      filter.isActive =
        isActive === true ||
        isActive === "true";
    }

    // ==================== Pagination ====================

    const pageNumber = Math.max(
      Number(page) || 1,
      1,
    );

    const limitNumber = Math.min(
      Math.max(Number(limit) || 20, 1),
      100,
    );

    const skip =
      (pageNumber - 1) * limitNumber;

    // ==================== Get Variants ====================

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
          createdAt: -1,
        })
        .skip(skip)
        .limit(limitNumber),

      ProductVariant.countDocuments(
        filter,
      ),
    ]);

    // ==================== Pagination Information ====================

    const totalPages = Math.ceil(
      totalVariants / limitNumber,
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
          pageNumber < totalPages,

        hasPreviousPage:
          pageNumber > 1,
      },

      data: {
        variants,
      },
    });
  };

  // ==================== Get Variants By Product ====================

  getVariantsByProduct = async (
    req,
    res,
  ) => {
    const { productId } = req.params;

    // ==================== Check Product ====================

    const product =
      await Product.findById(productId);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    // ==================== Get Variants ====================

    const variants =
      await ProductVariant.find({
        product: productId,
      })
        .populate({
          path: "product",

          select:
            "name modelCode brand category images isActive",
        })
        .sort({
          color: 1,
          size: 1,
        });

    // ==================== Response ====================

    return res.status(200).json({
      success: true,

      results: variants.length,

      data: {
        variants,
      },
    });
  };

  // ==================== Get Product Variant By Id ====================

  getProductVariantById = async (
    req,
    res,
  ) => {
    const { id } = req.params;

    // ==================== Get Variant ====================

    const variant =
      await ProductVariant.findById(
        id,
      ).populate({
        path: "product",

        select:
          "name modelCode brand category images isActive",
      });

    // ==================== Check Variant ====================

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

  // ==================== Update Product Variant ====================

  updateProductVariant = async (
    req,
    res,
  ) => {
    const { id } = req.params;

    const {
      color,
      size,
      sku,
      isActive,
    } = req.body;

    // ==================== Get Variant ====================

    const variant =
      await ProductVariant.findById(id);

    if (!variant) {
      return res.status(404).json({
        success: false,
        message:
          "Product variant not found",
      });
    }

    // ==================== Prepare Updated Values ====================

    const updatedColor =
      color !== undefined
        ? color.trim()
        : variant.color;

    const updatedSize =
      size !== undefined
        ? size
        : variant.size;

    // ==================== Check Duplicate Variant ====================

    if (
      color !== undefined ||
      size !== undefined
    ) {
      const existingVariant =
        await ProductVariant.findOne({
          _id: {
            $ne: variant._id,
          },

          product:
            variant.product,

          color: updatedColor,

          size: updatedSize,
        });

      if (existingVariant) {
        return res.status(409).json({
          success: false,
          message:
            "This product variant already exists",
        });
      }
    }

    // ==================== Update SKU ====================

    if (sku !== undefined) {
      const normalizedSku =
        sku.trim().toUpperCase();

      // ==================== Check Existing SKU ====================

      const existingSku =
        await ProductVariant.findOne({
          _id: {
            $ne: variant._id,
          },

          sku: normalizedSku,
        });

      if (existingSku) {
        return res.status(409).json({
          success: false,
          message:
            "This SKU is already in use",
        });
      }

      variant.sku =
        normalizedSku;
    }

    // ==================== Update Color ====================

    if (color !== undefined) {
      variant.color =
        updatedColor;
    }

    // ==================== Update Size ====================

    if (size !== undefined) {
      variant.size =
        updatedSize;
    }

    // ==================== Update Status ====================

    if (isActive !== undefined) {
      variant.isActive =
        isActive;
    }

    // ==================== Save Variant ====================

    await variant.save();

    // ==================== Populate Product ====================

    await variant.populate({
      path: "product",

      select:
        "name modelCode brand category images isActive",
    });

    // ==================== Response ====================

    return res.status(200).json({
      success: true,

      message:
        "Product variant updated successfully",

      data: {
        variant,
      },
    });
  };

  // ==================== Archive Product Variant ====================

  archiveProductVariant = async (
    req,
    res,
  ) => {
    const { id } = req.params;

    // ==================== Get Variant ====================

    const variant =
      await ProductVariant.findById(id);

    if (!variant) {
      return res.status(404).json({
        success: false,
        message:
          "Product variant not found",
      });
    }

    // ==================== Check Variant Status ====================

    if (!variant.isActive) {
      return res.status(400).json({
        success: false,
        message:
          "Product variant is already archived",
      });
    }

    // ==================== Check Reserved Stock ====================

    if (
      variant.reservedQuantity > 0
    ) {
      return res.status(409).json({
        success: false,

        message:
          "Cannot archive a variant with reserved stock",
      });
    }

    // ==================== Archive Variant ====================

    variant.isActive = false;

    await variant.save();

    // ==================== Response ====================

    return res.status(200).json({
      success: true,

      message:
        "Product variant archived successfully",
    });
  };

  // ==================== Restore Product Variant ====================

  restoreProductVariant = async (
    req,
    res,
  ) => {
    const { id } = req.params;

    // ==================== Get Variant ====================

    const variant =
      await ProductVariant.findById(id);

    if (!variant) {
      return res.status(404).json({
        success: false,
        message:
          "Product variant not found",
      });
    }

    // ==================== Check Variant Status ====================

    if (variant.isActive) {
      return res.status(400).json({
        success: false,

        message:
          "Product variant is already active",
      });
    }

    // ==================== Get Product ====================

    const product =
      await Product.findById(
        variant.product,
      );

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    // ==================== Check Product Status ====================

    if (!product.isActive) {
      return res.status(400).json({
        success: false,

        message:
          "Cannot restore a variant while its product is inactive",
      });
    }

    // ==================== Restore Variant ====================

    variant.isActive = true;

    await variant.save();

    // ==================== Populate Product ====================

    await variant.populate({
      path: "product",

      select:
        "name modelCode brand category images isActive",
    });

    // ==================== Response ====================

    return res.status(200).json({
      success: true,

      message:
        "Product variant restored successfully",

      data: {
        variant,
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
  new ProductVariantController();