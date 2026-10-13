const Product = require("../models/product.model");
const ProductVariant = require("../models/productVariant.model");

const { buildPagination, buildPaginationResponse } = require("../helpers/pagination.helper");
const { buildSearchFilter, escapeRegex } = require("../helpers/search.helper");

const { uploadImage, deleteImage } = require("../services/cloudinary.service");

class ProductController {
  // ==================== Create Product ====================

  createProduct = async (req, res) => {
    const { name, modelCode, description, brand, category, costPrice, defaultSalePrice } = req.body;

    const normalizedModelCode = modelCode.toUpperCase();

    const existingProduct = await Product.findOne({ modelCode: normalizedModelCode });

    if (existingProduct)
      return res.status(409).json({
        success: false,
        message: `Product model code ${normalizedModelCode} already exists`
      });

    const product = await Product.create({
      name,
      modelCode: normalizedModelCode,
      description,
      brand,
      category,
      costPrice,
      defaultSalePrice,
      createdBy: req.user._id
    });

// ==================== Upload Product Images ====================

if (req.files?.length) {
  const uploadedImages = await Promise.all(
    req.files.map((file) =>
      uploadImage(file, "sinuora/products")
    )
  );

  product.images = uploadedImages.map((image) => ({
    url: image.url,
    publicId: image.publicId
  }));

  await product.save();
}

    await product.populate({
      path: "createdBy",
      select: "fullName role"
    });

    return res.status(201).json({
      success: true,
      message: `Product ${product.name} created successfully`,
      data: { product }
    });
  };

  // ==================== Get Products ====================

  getProducts = async (req, res) => {
    const { page = 1, limit = 20, search, brand, category, isActive } = req.query;

    const filter = {
      ...buildSearchFilter(search, ["name", "modelCode"])
    };

    if (brand)
      filter.brand = {
        $regex: `^${escapeRegex(brand)}$`,
        $options: "i"
      };

    if (category)
      filter.category = {
        $regex: `^${escapeRegex(category)}$`,
        $options: "i"
      };

    if (isActive !== undefined)
      filter.isActive = isActive;

    const { skip } = buildPagination(page, limit);

    const [products, totalProducts] = await Promise.all([
      Product.find(filter)
        .populate("createdBy", "fullName role")
        .populate("updatedBy", "fullName role")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),

      Product.countDocuments(filter)
    ]);

    return res.status(200).json({
      success: true,
      message: "Products retrieved successfully",
      results: products.length,
      pagination: buildPaginationResponse(page, limit, totalProducts),
      data: { products }
    });
  };

  // ==================== Get Product By Id ====================

  getProductById = async (req, res) => {
    const product = await Product.findById(req.params.id)
      .populate("createdBy", "fullName role")
      .populate("updatedBy", "fullName role");

    if (!product)
      return res.status(404).json({
        success: false,
        message: `Product ${req.params.id} not found`
      });

    const variants = await ProductVariant.find({
      product: product._id
    }).sort({
      color: 1,
      size: 1
    });

    return res.status(200).json({
      success: true,
      message: `Product ${product.name} retrieved successfully`,
      data: {
        product,
        variants
      }
    });
  };

  // ==================== Update Product ====================

  updateProduct = async (req, res) => {
    const { id } = req.params;

    const {
      name,
      modelCode,
      description,
      brand,
      category,
      costPrice,
      defaultSalePrice,
      isActive
    } = req.body;

    const product = await Product.findById(id);

    if (!product)
      return res.status(404).json({
        success: false,
        message: `Product ${id} not found`
      });

    if (modelCode !== undefined) {
      const normalizedModelCode = modelCode.toUpperCase();

      const existingProduct = await Product.findOne({
        _id: { $ne: id },
        modelCode: normalizedModelCode
      });

      if (existingProduct)
        return res.status(409).json({
          success: false,
          message: `Product model code ${normalizedModelCode} already exists`
        });

      product.modelCode = normalizedModelCode;
    }

    if (name !== undefined)
      product.name = name;

    if (description !== undefined)
      product.description = description;

    if (brand !== undefined)
      product.brand = brand;

    if (category !== undefined)
      product.category = category;

    if (costPrice !== undefined)
      product.costPrice = costPrice;

    if (defaultSalePrice !== undefined)
      product.defaultSalePrice = defaultSalePrice;

    if (isActive !== undefined)
      product.isActive = isActive;

// ==================== Add Product Images ====================

if (req.files?.length) {
  const uploadedImages = await Promise.all(
    req.files.map((file) =>
      uploadImage(file, "sinuora/products")
    )
  );

  const newImages = uploadedImages.map((image) => ({
    url: image.url,
    publicId: image.publicId
  }));

  product.images.push(...newImages);
}

    product.updatedBy = req.user._id;

    await product.save();

    await product.populate([
      {
        path: "createdBy",
        select: "fullName role"
      },
      {
        path: "updatedBy",
        select: "fullName role"
      }
    ]);

    return res.status(200).json({
      success: true,
      message: `Product ${product.name} updated successfully`,
      data: { product }
    });
  };

  // ==================== Delete Product Image ====================

  deleteProductImage = async (req, res) => {
    const { id, imageId } = req.params;

    const product = await Product.findById(id);

    if (!product)
      return res.status(404).json({
        success: false,
        message: `Product ${id} not found`
      });

    const image = product.images.id(imageId);

    if (!image)
      return res.status(404).json({
        success: false,
        message: "Product image not found"
      });

    if (image.publicId)
      await deleteImage(image.publicId);

    product.images.pull(imageId);

    product.updatedBy = req.user._id;

    await product.save();

    return res.status(200).json({
      success: true,
      message: "Product image deleted successfully",
      data: {
        images: product.images
      }
    });
  };

  // ==================== Archive Product ====================

  archiveProduct = async (req, res) => {
    const product = await Product.findById(req.params.id);

    if (!product)
      return res.status(404).json({
        success: false,
        message: `Product ${req.params.id} not found`
      });

    if (!product.isActive)
      return res.status(400).json({
        success: false,
        message: "Product is already archived"
      });

    const reservedVariant = await ProductVariant.exists({
      product: product._id,
      reservedQuantity: { $gt: 0 }
    });

    if (reservedVariant)
      return res.status(409).json({
        success: false,
        message: "Cannot archive product because one or more variants have reserved stock"
      });

    product.isActive = false;

    product.updatedBy = req.user._id;

    await product.save();

    return res.status(200).json({
      success: true,
      message: `Product ${product.name} archived successfully`
    });
  };

  // ==================== Restore Product ====================

  restoreProduct = async (req, res) => {
    const product = await Product.findById(req.params.id);

    if (!product)
      return res.status(404).json({
        success: false,
        message: `Product ${req.params.id} not found`
      });

    if (product.isActive)
      return res.status(400).json({
        success: false,
        message: "Product is already active"
      });

    product.isActive = true;

    product.updatedBy = req.user._id;

    await product.save();

    return res.status(200).json({
      success: true,
      message: `Product ${product.name} restored successfully`,
      data: { product }
    });
  };
}

module.exports = new ProductController();