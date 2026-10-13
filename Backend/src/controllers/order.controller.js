const Order = require("../models/order.model");
const OrderStatusHistory = require("../models/orderStatusHistory.model");

const orderHelper = require("../helpers/order.helper");
const { buildPagination, buildPaginationResponse } = require("../helpers/pagination.helper");

// ==================== Order Controller ====================

class OrderController {

  // ==================== Create Order ====================

  createOrder = async (req, res) => {
    const { customer, items, deliveryFee, discount, notes } = req.body;

    const result = await orderHelper.createOrder({
      user: req.user,
      body: { customer, items, deliveryFee, discount, notes },
      key: req.get("Idempotency-Key"),
    });

    return res.status(result.replayed ? 200 : 201).json({
      success: true,
      message: result.replayed ? "Order already created" : "Order created successfully",
      replayed: result.replayed,
      data: { order: result.order },
    });
  };

  // ==================== Get Orders ====================

  getOrders = async (req, res) => {
    const { page = 1, limit = 20, status, createdBy } = req.query;

    const filters = {};

    if (status) filters.status = status;
    if (createdBy) filters.createdBy = createdBy;

    const filter = { $and: [orderHelper.scope(req.user), filters] };
    const { skip } = buildPagination(page, limit);

    const [orders, totalOrders] = await Promise.all([
      Order.find(filter).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(Number(limit)),
      Order.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      message: "Orders retrieved successfully",
      results: orders.length,
      pagination: buildPaginationResponse(page, limit, totalOrders),
      data: { orders: orders.map((order) => orderHelper.serialize(order)) },
    });
  };

  // ==================== Get Order By Id ====================

  getOrderById = async (req, res) => {
    const { id } = req.params;

    const order = await Order.findOne({ $and: [{ _id: id }, orderHelper.scope(req.user)] });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    const history = await OrderStatusHistory.find({ order: order._id })
      .populate("changedBy", "fullName email role")
      .sort({ createdAt: 1, _id: 1 });

    return res.status(200).json({
      success: true,
      message: "Order retrieved successfully",
      data: { order: orderHelper.serialize(order), history },
    });
  };

  // ==================== Update Order ====================

  updateOrder = async (req, res) => {
    const { id } = req.params;
    const { customer, items, deliveryFee, discount, notes } = req.body;

    const body = Object.fromEntries(
      Object.entries({ customer, items, deliveryFee, discount, notes }).filter(([, value]) => value !== undefined)
    );

    const result = await orderHelper.updateOrder({ user: req.user, id, body });

    return res.status(200).json({
      success: true,
      message: "Order updated successfully",
      data: { order: result.order },
    });
  };

  // ==================== Cancel Order ====================

  cancelOrder = async (req, res) => {
    const { id } = req.params;
    const { reason, note } = req.body;

    const result = await orderHelper.cancelOrder({
      user: req.user,
      id,
      body: { reason, note },
    });

    return res.status(200).json({
      success: true,
      message: "Order cancelled successfully",
      replayed: result.replayed,
      data: { order: result.order },
    });
  };

  // ==================== Start Preparing ====================

  startPreparing = async (req, res) => {
    const { id } = req.params;
    const { reason, note } = req.body;

    const result = await orderHelper.startPreparing({
      user: req.user,
      id,
      body: { reason, note },
    });

    return res.status(200).json({
      success: true,
      message: "Order is now preparing",
      data: { order: result.order },
    });
  };

  // ==================== Mark Prepared ====================

  markPrepared = async (req, res) => {
    const { id } = req.params;
    const { reason, note } = req.body;

    const result = await orderHelper.markPrepared({
      user: req.user,
      id,
      body: { reason, note },
    });

    return res.status(200).json({
      success: true,
      message: "Order prepared successfully",
      data: { order: result.order },
    });
  };

  // ==================== Dispatch Order ====================

  dispatchOrder = async (req, res) => {
    const { id } = req.params;
    const { reason, note } = req.body;

    const result = await orderHelper.dispatchOrder({
      user: req.user,
      id,
      body: { reason, note },
    });

    return res.status(200).json({
      success: true,
      message: "Order dispatched successfully",
      data: { order: result.order },
    });
  };

  // ==================== Deliver Order ====================

  deliverOrder = async (req, res) => {
    const { id } = req.params;
    const { reason, note } = req.body;

    const result = await orderHelper.deliverOrder({
      user: req.user,
      id,
      body: { reason, note },
    });

    return res.status(200).json({
      success: true,
      message: "Order delivered successfully",
      data: { order: result.order },
    });
  };

  // ==================== Return Order Items ====================

  returnOrderItems = async (req, res) => {
    const { id } = req.params;
    const { items, reason, note } = req.body;

    const result = await orderHelper.returnOrderItems({
      user: req.user,
      id,
      body: { items, reason, note },
      key: req.get("Idempotency-Key"),
    });

    return res.status(200).json({
      success: true,
      message: "Order items returned successfully",
      replayed: result.replayed,
      data: {
        order: result.order,
        ...(result.orderReturn && { orderReturn: result.orderReturn }),
      },
    });
  };

  // ==================== Get Order Status History ====================

  getOrderStatusHistory = async (req, res) => {
    const { id } = req.params;

    const order = await Order.findOne({
      $and: [{ _id: id }, orderHelper.scope(req.user)],
    }).select("_id");

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    const history = await OrderStatusHistory.find({ order: order._id })
      .populate("changedBy", "fullName email role")
      .sort({ createdAt: 1, _id: 1 });

    return res.status(200).json({
      success: true,
      message: "Order status history retrieved successfully",
      results: history.length,
      data: { history },
    });
  };
}

// ==================== Export Controller ====================

module.exports = new OrderController();