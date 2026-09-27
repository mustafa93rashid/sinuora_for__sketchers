const Product = require("../models/product.model");
const ProductVariant = require("../models/productVariant.model");
const { buildPagination, buildPaginationResponse } = require("../helper/pagination.helper");
const { buildSearchFilter, escapeRegex } = require("../helper/search.helper");
class ProductController {
  // ==================== Create Product ====================

  createProduct = async (req, res) => {
    const { name, modelCode, description, brand, category, images, costPrice, defaultSalePrice } = req.body;

    const normalizedModelCode = modelCode.toUpperCase();
    const existingProduct = await Product.findOne({ modelCode: normalizedModelCode });

    if (existingProduct)
      return res.status(409).json({
        success: false,
        message: `Product model code ${normalizedModelCode} already exists`
      });

    const product = await Product.create
      ({ name, modelCode: normalizedModelCode, description, brand, category, images, costPrice, defaultSalePrice, createdBy: req.user._id });

    await product.populate({ path: "createdBy", select: "name role" });

    return res.status(201).json({
      success: true,
      message: `Product ${product.name} created successfully`,
      data: { product }
    });
  };

  // ==================== Get Products ====================

getProducts = async (req, res) => {
  const { page = 1, limit = 20, search, brand, category, isActive } = req.query;
  const filter = { ...buildSearchFilter(search, ["name", "modelCode"]) };

  if (brand) filter.brand = { $regex: `^${escapeRegex(brand)}$`, $options: "i" };
  if (category) filter.category = { $regex: `^${escapeRegex(category)}$`, $options: "i" };
  if (isActive !== undefined) filter.isActive = isActive;

  const { skip } = buildPagination(page, limit);

  const [products, totalProducts] = await Promise.all([
    Product.find(filter)
    .populate("createdBy", "name email role")
    .populate("updatedBy", "name email role")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit),
    Product.countDocuments(filter),
  ]);

  return res.status(200).json({
    success: true,
    message: "Products retrieved successfully",
    results: products.length,
    pagination: buildPaginationResponse(page, limit, totalProducts),
    data: { products },
  });
};

  // ==================== Get Product By Id ====================

  getProductById = async (req, res) => {
    const product = await Product.findById(req.params.id).populate("createdBy", "name email role").populate("updatedBy", "name email role");
    if (!product) return res.status(404).json({ success: false, message: "Product not found" });
    const variants = await ProductVariant.find({ product: product._id }).sort({ color: 1, size: 1 });
    return res.status(200).json({ success: true, data: { product, variants } });
  };

  // ==================== Update Product ====================

  updateProduct = async (req, res) => {
    const { id } = req.params;
    const { name, modelCode, description, brand, category, images, costPrice, defaultSalePrice, isActive } = req.body;
    const product = await Product.findById(id);
    if (!product) return res.status(404).json({ success: false, message: "Product not found" });

    if (modelCode !== undefined) {
      const normalizedModelCode = modelCode.toUpperCase();
      const existingProduct = await Product.findOne({ _id: { $ne: id }, modelCode: normalizedModelCode });
      if (existingProduct) return res.status(409).json({ success: false, message: `Product model code ${normalizedModelCode} already exists` });
      product.modelCode = normalizedModelCode;
    }

    if (name !== undefined) product.name = name;
    if (description !== undefined) product.description = description;
    if (brand !== undefined) product.brand = brand;
    if (category !== undefined) product.category = category;
    if (images !== undefined) product.images = images;
    if (costPrice !== undefined) product.costPrice = costPrice;
    if (defaultSalePrice !== undefined) product.defaultSalePrice = defaultSalePrice;
    if (isActive !== undefined) product.isActive = isActive;
    product.updatedBy = req.user._id;

    await product.save();
    await product.populate([{ path: "createdBy", select: "name email role" }, { path: "updatedBy", select: "name email role" }]);
    return res.status(200).json({ success: true, message: "Product updated successfully", data: { product } });
  };

  // ==================== Archive Product ====================

  archiveProduct = async (req, res) => {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ success: false, message: "Product not found" });
    if (!product.isActive) return res.status(400).json({ success: false, message: "Product is already archived" });

    const reservedVariant = await ProductVariant.exists({ product: product._id, reservedQuantity: { $gt: 0 } });
    if (reservedVariant) return res.status(409).json({ success: false, message: "Cannot archive product because one or more variants have reserved stock" });

    product.isActive = false;
    product.updatedBy = req.user._id;
    await product.save();

    return res.status(200).json({ success: true, message: "Product archived successfully" });
  };

  // ==================== Restore Product ====================

  restoreProduct = async (req, res) => {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ success: false, message: "Product not found" });
    if (product.isActive) return res.status(400).json({ success: false, message: "Product is already active" });

    product.isActive = true;
    product.updatedBy = req.user._id;
    await product.save();

    return res.status(200).json({ success: true, message: "Product restored successfully", data: { product } });
  };

  // ==================== Escape Regex ====================

  escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ==================== Export Controller ====================

module.exports = new ProductController();