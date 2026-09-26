const Product = require(
  "../models/product.model",
);

const ProductVariant = require(
  "../models/productVariant.model",
);

// ==================== Product Controller ====================

class ProductController {
  // ==================== Create Product ====================

  createProduct = async (req, res) => {
    const {
      name,
      modelCode,
      description,
      brand,
      category,
      images,
      costPrice,
      defaultSalePrice,
    } = req.body;

    const createdBy =
      req.user?._id || req.user?.id;

    // ==================== Normalize Model Code ====================

    const normalizedModelCode =
      modelCode.trim().toUpperCase();

    // ==================== Check Existing Product ====================

    const existingProduct =
      await Product.findOne({
        modelCode:
          normalizedModelCode,
      });

    if (existingProduct) {
      return res.status(409).json({
        success: false,

        message:
          "Product model code already exists",
      });
    }

    // ==================== Create Product ====================

    const product =
      await Product.create({
        name: name.trim(),

        modelCode:
          normalizedModelCode,

        description:
          description?.trim() || "",

        brand:
          brand?.trim() ||
          "Skechers",

        category:
          category?.trim() ||
          "Shoes",

        images: images || [],

        costPrice:
          costPrice ?? 0,

        defaultSalePrice:
          defaultSalePrice ?? 0,

        createdBy,
      });

    // ==================== Populate User ====================

    await product.populate({
      path: "createdBy",

      select:
        "name email role",
    });

    // ==================== Response ====================

    return res.status(201).json({
      success: true,

      message:
        "Product created successfully",

      data: {
        product,
      },
    });
  };

  // ==================== Get Products ====================

  getProducts = async (req, res) => {
    const {
      page = 1,
      limit = 20,
      search,
      brand,
      category,
      isActive,
    } = req.query;

    const filter = {};

    // ==================== Search ====================

    if (search) {
      const searchRegex =
        this.escapeRegex(
          search.trim(),
        );

      filter.$or = [
        {
          name: {
            $regex: searchRegex,
            $options: "i",
          },
        },

        {
          modelCode: {
            $regex: searchRegex,
            $options: "i",
          },
        },
      ];
    }

    // ==================== Brand Filter ====================

    if (brand) {
      filter.brand = {
        $regex: `^${this.escapeRegex(
          brand.trim(),
        )}$`,

        $options: "i",
      };
    }

    // ==================== Category Filter ====================

    if (category) {
      filter.category = {
        $regex: `^${this.escapeRegex(
          category.trim(),
        )}$`,

        $options: "i",
      };
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
      Math.max(
        Number(limit) || 20,
        1,
      ),
      100,
    );

    const skip =
      (pageNumber - 1) *
      limitNumber;

    // ==================== Get Products ====================

    const [
      products,
      totalProducts,
    ] = await Promise.all([
      Product.find(filter)
        .populate({
          path: "createdBy",

          select:
            "name email role",
        })
        .populate({
          path: "updatedBy",

          select:
            "name email role",
        })
        .sort({
          createdAt: -1,
        })
        .skip(skip)
        .limit(limitNumber),

      Product.countDocuments(
        filter,
      ),
    ]);

    // ==================== Pagination Information ====================

    const totalPages = Math.ceil(
      totalProducts /
        limitNumber,
    );

    // ==================== Response ====================

    return res.status(200).json({
      success: true,

      results: products.length,

      pagination: {
        page: pageNumber,

        limit: limitNumber,

        totalProducts,

        totalPages,

        hasNextPage:
          pageNumber <
          totalPages,

        hasPreviousPage:
          pageNumber > 1,
      },

      data: {
        products,
      },
    });
  };

  // ==================== Get Product By Id ====================

  getProductById = async (
    req,
    res,
  ) => {
    const { id } = req.params;

    // ==================== Get Product ====================

    const product =
      await Product.findById(id)
        .populate({
          path: "createdBy",

          select:
            "name email role",
        })
        .populate({
          path: "updatedBy",

          select:
            "name email role",
        });

    if (!product) {
      return res.status(404).json({
        success: false,

        message:
          "Product not found",
      });
    }

    // ==================== Get Product Variants ====================

    const variants =
      await ProductVariant.find({
        product: product._id,
      }).sort({
        color: 1,
        size: 1,
      });

    // ==================== Response ====================

    return res.status(200).json({
      success: true,

      data: {
        product,
        variants,
      },
    });
  };

  // ==================== Update Product ====================

  updateProduct = async (
    req,
    res,
  ) => {
    const { id } = req.params;

    const {
      name,
      modelCode,
      description,
      brand,
      category,
      images,
      costPrice,
      defaultSalePrice,
      isActive,
    } = req.body;

    const updatedBy =
      req.user?._id || req.user?.id;

    // ==================== Get Product ====================

    const product =
      await Product.findById(id);

    if (!product) {
      return res.status(404).json({
        success: false,

        message:
          "Product not found",
      });
    }

    // ==================== Check Model Code ====================

    if (modelCode !== undefined) {
      const normalizedModelCode =
        modelCode
          .trim()
          .toUpperCase();

      const existingProduct =
        await Product.findOne({
          _id: {
            $ne: product._id,
          },

          modelCode:
            normalizedModelCode,
        });

      if (existingProduct) {
        return res.status(409).json({
          success: false,

          message:
            "Product model code already exists",
        });
      }

      product.modelCode =
        normalizedModelCode;
    }

    // ==================== Update Name ====================

    if (name !== undefined) {
      product.name =
        name.trim();
    }

    // ==================== Update Description ====================

    if (description !== undefined) {
      product.description =
        description.trim();
    }

    // ==================== Update Brand ====================

    if (brand !== undefined) {
      product.brand =
        brand.trim();
    }

    // ==================== Update Category ====================

    if (category !== undefined) {
      product.category =
        category.trim();
    }

    // ==================== Update Images ====================

    if (images !== undefined) {
      product.images = images;
    }

    // ==================== Update Cost Price ====================

    if (costPrice !== undefined) {
      product.costPrice =
        costPrice;
    }

    // ==================== Update Default Sale Price ====================

    if (
      defaultSalePrice !==
      undefined
    ) {
      product.defaultSalePrice =
        defaultSalePrice;
    }

    // ==================== Update Status ====================

    if (isActive !== undefined) {
      product.isActive =
        isActive;
    }

    // ==================== Update User ====================

    product.updatedBy =
      updatedBy;

    // ==================== Save Product ====================

    await product.save();

    // ==================== Populate Users ====================

    await product.populate([
      {
        path: "createdBy",

        select:
          "name email role",
      },

      {
        path: "updatedBy",

        select:
          "name email role",
      },
    ]);

    // ==================== Response ====================

    return res.status(200).json({
      success: true,

      message:
        "Product updated successfully",

      data: {
        product,
      },
    });
  };

  // ==================== Archive Product ====================

  archiveProduct = async (
    req,
    res,
  ) => {
    const { id } = req.params;

    const updatedBy =
      req.user?._id || req.user?.id;

    // ==================== Get Product ====================

    const product =
      await Product.findById(id);

    if (!product) {
      return res.status(404).json({
        success: false,

        message:
          "Product not found",
      });
    }

    // ==================== Check Product Status ====================

    if (!product.isActive) {
      return res.status(400).json({
        success: false,

        message:
          "Product is already archived",
      });
    }

    // ==================== Check Reserved Variants ====================

    const reservedVariant =
      await ProductVariant.findOne({
        product: product._id,

        reservedQuantity: {
          $gt: 0,
        },
      });

    if (reservedVariant) {
      return res.status(409).json({
        success: false,

        message:
          "Cannot archive product because one or more variants have reserved stock",
      });
    }

    // ==================== Archive Product ====================

    product.isActive = false;

    product.updatedBy =
      updatedBy;

    await product.save();

    // ==================== Archive Product Variants ====================

    await ProductVariant.updateMany(
      {
        product: product._id,
      },

      {
        $set: {
          isActive: false,
        },
      },
    );

    // ==================== Response ====================

    return res.status(200).json({
      success: true,

      message:
        "Product archived successfully",
    });
  };

  // ==================== Restore Product ====================

  restoreProduct = async (
    req,
    res,
  ) => {
    const { id } = req.params;

    const updatedBy =
      req.user?._id || req.user?.id;

    // ==================== Get Product ====================

    const product =
      await Product.findById(id);

    if (!product) {
      return res.status(404).json({
        success: false,

        message:
          "Product not found",
      });
    }

    // ==================== Check Product Status ====================

    if (product.isActive) {
      return res.status(400).json({
        success: false,

        message:
          "Product is already active",
      });
    }

    // ==================== Restore Product ====================

    product.isActive = true;

    product.updatedBy =
      updatedBy;

    await product.save();

    // ==================== Response ====================

    return res.status(200).json({
      success: true,

      message:
        "Product restored successfully",

      data: {
        product,
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
  new ProductController();