
const express = require("express");
const router = express.Router();

const auth = require("../middlewares/auth");
const role = require("../middlewares/role");
const { createGeneralApiLimiter } = require("../middlewares/limiter");
const asyncHandler = require("../utils/asyncHandler");

const orderController = require("../controllers/order.controller");

const {
  createOrderValidation,
  updateOrderValidation,
  orderIdValidation,
  orderActionValidation,
  cancelOrderValidation,
  returnOrderValidation,
  getOrdersValidation,
} = require("../validation/order.validation");

router.use(auth);
router.use(createGeneralApiLimiter());

// ==================== Orders ====================

router.get("/", getOrdersValidation, asyncHandler(orderController.getOrders));

router.post("/", [role(["superadmin", "manager", "saler"])], createOrderValidation, asyncHandler(orderController.createOrder));

// ==================== Order By Id ====================

router.get("/:id", orderIdValidation, asyncHandler(orderController.getOrderById));

router.patch("/:id", [role(["superadmin", "manager", "saler"])], updateOrderValidation, asyncHandler(orderController.updateOrder));

// ==================== Cancel Order ====================

router.patch("/:id/cancel", [role(["superadmin", "manager", "saler"])], cancelOrderValidation, asyncHandler(orderController.cancelOrder));

// ==================== Prepare Order ====================

router.patch("/:id/prepare", [role(["superadmin", "manager"])], orderActionValidation, asyncHandler(orderController.startPreparing));

router.patch("/:id/prepared", [role(["superadmin", "manager"])], orderActionValidation, asyncHandler(orderController.markPrepared));

// ==================== Dispatch Order ====================

router.patch("/:id/dispatch", [role(["superadmin", "manager"])], orderActionValidation, asyncHandler(orderController.dispatchOrder));

// ==================== Deliver Order ====================

router.patch("/:id/deliver", [role(["superadmin", "manager", "saler", "follow-up"])], orderActionValidation, asyncHandler(orderController.deliverOrder));

// ==================== Return Order ====================

router.post("/:id/returns", [role(["superadmin", "manager", "saler", "follow-up"])], returnOrderValidation, asyncHandler(orderController.returnOrderItems));

// ==================== Order Status History ====================

router.get("/:id/history", orderIdValidation, asyncHandler(orderController.getOrderStatusHistory));

// ==================== Export Router ====================

module.exports = router;
