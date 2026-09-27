const express = require("express");

const inventoryController = require("../controllers/inventory.controller");

const {
  addStockValidation,
  adjustStockValidation,
  getInventoryValidation,
  variantInventoryValidation,
  getInventoryTransactionsValidation,
  getVariantTransactionsValidation,
} = require("../validation/inventory.validation");

const auth = require("../middlewares/auth.middleware");

const authorize = require("../middlewares/authorize.middleware");

// ==================== Router ====================

const router = express.Router();

// ==================== Inventory ====================

router.get("/", auth, getInventoryValidation, inventoryController.getInventory);

// ==================== Inventory Transactions ====================

router.get("/transactions", auth, getInventoryTransactionsValidation, inventoryController.getInventoryTransactions);

// ==================== Variant Inventory ====================

router.get("/variant/:variantId", auth, variantInventoryValidation, inventoryController.getVariantInventory);

// ==================== Variant Transactions ====================

router.get("/variant/:variantId/transactions", auth, getVariantTransactionsValidation, inventoryController.getVariantTransactions);

// ==================== Add Stock ====================

router.post("/variant/:variantId/add", auth, authorize("SUPER_ADMIN", "MANAGER"), addStockValidation, inventoryController.addStock);

// ==================== Adjust Stock ====================

router.patch("/variant/:variantId/adjust", auth, authorize("SUPER_ADMIN", "MANAGER"), adjustStockValidation, inventoryController.adjustStock);

// ==================== Export Router ====================

module.exports = router;