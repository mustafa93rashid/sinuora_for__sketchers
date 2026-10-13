const { param, query } = require("express-validator");
const validate = require("../middlewares/validate");
const input = require("../helpers/orderInput.helper");

// ==================== Validate Order Payload ====================

const payload = (normalize, needsKey = false) => (req, res, next) => {
  try {
    req.body = normalize(req.body);
    if (needsKey) input.key(req.get("Idempotency-Key"));
    next();
  } catch (error) { next(error); }
};
const orderIdValidation = [param("id").isMongoId(), validate];
const createOrderValidation = [payload((body) => input.order(body), true)];
const updateOrderValidation = [...orderIdValidation, payload((body) => input.order(body, true))];
const orderActionValidation = [...orderIdValidation, payload((body) => input.action(body))];
const cancelOrderValidation = [...orderIdValidation, payload((body) => input.action(body, true))];
const returnOrderValidation = [...orderIdValidation, payload(input.returns, true)];

// ==================== Validate Order Filters ====================

const getOrdersValidation = [
  query("page").optional().isInt({ min: 1, max: 1000000 }),
  query("limit").optional().isInt({ min: 1, max: 100 }),
  query("createdBy").optional().isMongoId(),
  query("status").optional().isIn(["New", "Preparing", "Prepared", "Out For Delivery", "Delivered", "Returned", "Partially Returned", "Cancelled"]),
  validate,
];

module.exports = { createOrderValidation, updateOrderValidation, orderIdValidation, orderActionValidation, cancelOrderValidation, returnOrderValidation, getOrdersValidation };
