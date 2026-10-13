
const express = require("express");
const router = express.Router();

const auth = require("../middlewares/auth");
const role = require("../middlewares/role");
const asyncHandler = require("../utils/asyncHandler");

const orderController = require("../controllers/order.controller");

const { createOrderValidation, updateOrderValidation, orderIdValidation, orderActionValidation, cancelOrderValidation, returnOrderValidation, getOrdersValidation } = require("../validation/order.validation");

// ==================== Orders ====================

router.get("/", [auth], getOrdersValidation, asyncHandler(orderController.getOrders));

router.post("/", [auth, role(["superadmin", "manager", "saler"])], createOrderValidation, asyncHandler(orderController.createOrder));

// ==================== Order By Id ====================

router.get("/:id", [auth], orderIdValidation, asyncHandler(orderController.getOrderById));

router.patch("/:id", [auth, role(["superadmin", "manager", "saler"])], updateOrderValidation, asyncHandler(orderController.updateOrder));

// ==================== Cancel Order ====================

router.patch("/:id/cancel", [auth, role(["superadmin", "manager", "saler"])], cancelOrderValidation, asyncHandler(orderController.cancelOrder));

// ==================== Prepare Order ====================

router.patch("/:id/prepare", [auth, role(["superadmin", "manager"])], orderActionValidation, asyncHandler(orderController.startPreparing));

router.patch("/:id/prepared", [auth, role(["superadmin", "manager"])], orderActionValidation, asyncHandler(orderController.markPrepared));

// ==================== Dispatch Order ====================

router.patch("/:id/dispatch", [auth, role(["superadmin", "manager"])], orderActionValidation, asyncHandler(orderController.dispatchOrder));

// ==================== Deliver Order ====================

router.patch("/:id/deliver", [auth, role(["superadmin", "manager", "saler", "follow-up"])], orderActionValidation, asyncHandler(orderController.deliverOrder));

// ==================== Return Order ====================

router.post("/:id/returns", [auth, role(["superadmin", "manager", "saler", "follow-up"])], returnOrderValidation, asyncHandler(orderController.returnOrderItems));

// ==================== Order Status History ====================

router.get("/:id/history", [auth], orderIdValidation, asyncHandler(orderController.getOrderStatusHistory));

module.exports = router;
