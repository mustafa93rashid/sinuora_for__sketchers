const Order = require("../models/order.model");
const OrderStatusHistory = require("../models/orderStatusHistory.model");

const orderHelper = require("../helpers/order.helper");
const { buildPagination, buildPaginationResponse } = require("../helpers/pagination.helper");

// ==================== Order Controller ====================

class OrderController {


  // ==================== Create Order ====================

  createOrder = async ({ user, body, key }) => {
    if (!["superadmin", "manager", "saler"].includes(user.role)) {
      this.fail("Permission denied", 403);
    }

    body = input.order(body);
    key = input.key(key);

    await this.ensureIndexes();

    this.validateCustomer(body.customer);
    this.validateItems(body.items);

    const hash = this.createHash(body);
    const existing = await this.getExistingOrder(user, key, hash);

    if (existing) return existing;

    try {
      return await runTransaction(async (session) => {
        // ==================== Check Existing Order ====================

        if (key) {
          const replay = await Order.findOne({
            createdBy: user._id,
            idempotencyKey: key,
          }).session(session);

          if (replay) {
            if (replay.idempotencyHash !== hash) {
              this.fail("Idempotency key already used with different data", 409);
            }

            return {
              order: this.serialize(replay),
              replayed: true,
            };
          }
        }

        const orderItems = [];
        let subtotal = 0;

        // ==================== Prepare Order Items ====================

        for (const item of body.items) {
          const variant = await ProductVariant.findOne({
            _id: item.variant,
            isActive: true,
          }).session(session);

          if (!variant) {
            this.fail("Active product variant not found", 404);
          }

          const product = await Product.findOne({
            _id: variant.product,
            isActive: true,
          }).session(session);

          if (!product) {
            this.fail("Active product not found", 404);
          }

          // ==================== Calculate Selling Price ====================

          const totalPrice = item.quantity * item.unitPrice;

          if (!Number.isSafeInteger(totalPrice)) {
            this.fail("Invalid item total price");
          }

          // ==================== Calculate Product Cost ====================

          const unitCost = product.costPrice;

          if (!Number.isSafeInteger(unitCost) || unitCost < 0) {
            this.fail("Invalid product cost price");
          }

          const totalCost = item.quantity * unitCost;

          if (!Number.isSafeInteger(totalCost)) {
            this.fail("Invalid item total cost");
          }

          // ==================== Calculate Subtotal ====================

          subtotal += totalPrice;
          assertAmount(subtotal);

          // ==================== Add Order Item ====================

          orderItems.push({
            product: product._id,
            variant: variant._id,

            quantity: item.quantity,

            unitPrice: item.unitPrice,
            totalPrice,

            unitCost,
            totalCost,

            productSnapshot: {
              name: product.name,
              modelCode: product.modelCode,
              color: variant.color,
              size: variant.size,
              sku: variant.sku,
            },
          });
        }

        // ==================== Calculate Order Amount ====================

        const deliveryFee = body.deliveryFee ?? 0;
        const discount = body.discount ?? 0;

        if (!Number.isSafeInteger(deliveryFee) || deliveryFee < 0) {
          this.fail("Invalid delivery fee");
        }

        if (
          !Number.isSafeInteger(discount) ||
          discount < 0 ||
          discount > subtotal + deliveryFee
        ) {
          this.fail("Invalid discount");
        }

        assertAmount(subtotal + deliveryFee);

        const totalAmount = subtotal + deliveryFee - discount;

        if (!Number.isSafeInteger(totalAmount)) {
          this.fail("Invalid order amount");
        }

        // ==================== Create Order ====================

        const order = new Order({
          orderNumber: this.generateOrderNumber(),

          customer: body.customer,
          items: orderItems,

          status: "New",

          subtotal,
          deliveryFee,
          discount,
          totalAmount,

          deliveredAmount: 0,
          returnedAmount: 0,

          notes: body.notes,

          createdBy: user._id,
          updatedBy: user._id,

          ...(key && {
            idempotencyKey: key,
            idempotencyHash: hash,
          }),
        });

        await order.save({ session });

        // ==================== Reserve Stock ====================

        for (const item of order.items) {
          await inventoryHelper.reserveStock({
            variantId: item.variant,
            quantity: item.quantity,

            order: order._id,
            orderItem: item._id,

            performedBy: user._id,
            reason: "Order created",

            session,
          });
        }

        // ==================== Save Order Status History ====================

        await this.saveHistory({
          order,
          fromStatus: null,
          toStatus: "New",
          user,
          session,
        });

        return {
          order: this.serialize(order),
          replayed: false,
        };
      });
    } catch (error) {
      // ==================== Handle Duplicate Idempotency Key ====================

      if (error.code === 11000 && key) {
        const replay = await this.getExistingOrder(user, key, hash);

        if (replay) return replay;
      }

      throw error;
    }
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

  // ==================== Update Order ====================

  updateOrder = async ({ user, id, body }) => {
    if (!["superadmin", "manager", "saler"].includes(user.role)) {
      this.fail("Permission denied", 403);
    }

    body = input.order(body, true);

    return runTransaction(async (session) => {
      const order = await this.getAccessibleOrder(user, id, session);

      // ==================== Validate Order Status ====================

      if (!["New", "Preparing"].includes(order.status)) {
        this.fail("Order cannot be updated at this stage", 409);
      }

      // ==================== Validate Order Permission ====================

      if (
        !this.isAdmin(user) &&
        String(order.createdBy) !== String(user._id)
      ) {
        this.fail("Permission denied", 403);
      }

      // ==================== Update Customer ====================

      if (body.customer !== undefined) {
        this.validateCustomer(body.customer);
        order.customer = body.customer;
      }

      // ==================== Update Notes ====================

      if (body.notes !== undefined) {
        order.notes = body.notes;
      }

      // ==================== Update Order Items ====================

      if (body.items !== undefined) {
        this.validateItems(body.items);

        const oldItems = [...order.items];
        const newItems = [];

        let subtotal = 0;

        for (const itemInput of body.items) {
          // ==================== Get Product Variant ====================

          const variant = await ProductVariant.findOne({
            _id: itemInput.variant,
            isActive: true,
          }).session(session);

          if (!variant) {
            this.fail("Active product variant not found", 404);
          }

          // ==================== Get Product ====================

          const product = await Product.findOne({
            _id: variant.product,
            isActive: true,
          }).session(session);

          if (!product) {
            this.fail("Active product not found", 404);
          }

          // ==================== Find Previous Order Item ====================

          const previous = oldItems.find(
            (item) => String(item.variant) === String(variant._id)
          );

          const itemId = previous?._id ?? new mongoose.Types.ObjectId();

          const oldQuantity = previous?.quantity ?? 0;
          const newQuantity = itemInput.quantity;

          const difference = newQuantity - oldQuantity;

          // ==================== Calculate Selling Price ====================

          const totalPrice = newQuantity * itemInput.unitPrice;

          if (!Number.isSafeInteger(totalPrice)) {
            this.fail("Invalid item total price");
          }

          // ==================== Preserve Product Cost ====================

          const unitCost = previous?.unitCost ?? product.costPrice;

          if (!Number.isSafeInteger(unitCost) || unitCost < 0) {
            this.fail("Invalid product cost price");
          }

          const totalCost = newQuantity * unitCost;

          if (!Number.isSafeInteger(totalCost)) {
            this.fail("Invalid item total cost");
          }

          // ==================== Reserve Additional Stock ====================

          if (difference > 0) {
            await inventoryHelper.reserveStock({
              variantId: variant._id,
              quantity: difference,

              order: order._id,
              orderItem: itemId,

              performedBy: user._id,
              reason: "Order quantity increased",

              session,
            });
          }

          // ==================== Release Reduced Stock ====================

          if (difference < 0) {
            await inventoryHelper.releaseReservedStock({
              variantId: variant._id,
              quantity: Math.abs(difference),

              order: order._id,
              orderItem: previous._id,

              performedBy: user._id,
              reason: "Order quantity decreased",

              session,
            });
          }

          // ==================== Calculate Subtotal ====================

          subtotal += totalPrice;
          assertAmount(subtotal);

          // ==================== Add Updated Order Item ====================

          newItems.push({
            _id: itemId,

            product: product._id,
            variant: variant._id,

            quantity: newQuantity,

            unitPrice: itemInput.unitPrice,
            totalPrice,

            unitCost,
            totalCost,

            productSnapshot: previous?.productSnapshot ?? {
              name: product.name,
              modelCode: product.modelCode,
              color: variant.color,
              size: variant.size,
              sku: variant.sku,
            },
          });
        }

        // ==================== Release Removed Order Items ====================

        for (const previous of oldItems) {
          const exists = newItems.some(
            (item) => String(item.variant) === String(previous.variant)
          );

          if (!exists) {
            await inventoryHelper.releaseReservedStock({
              variantId: previous.variant,
              quantity: previous.quantity,

              order: order._id,
              orderItem: previous._id,

              performedBy: user._id,
              reason: "Order item removed",

              session,
            });
          }
        }

        // ==================== Save Updated Items ====================

        order.items = newItems;
        order.subtotal = subtotal;
      }

      // ==================== Update Delivery Fee ====================

      if (body.deliveryFee !== undefined) {
        order.deliveryFee = body.deliveryFee;
      }

      // ==================== Update Discount ====================

      if (body.discount !== undefined) {
        order.discount = body.discount;
      }

      // ==================== Validate Delivery Fee ====================

      if (
        !Number.isSafeInteger(order.deliveryFee) ||
        order.deliveryFee < 0
      ) {
        this.fail("Invalid delivery fee");
      }

      // ==================== Validate Discount ====================

      if (
        !Number.isSafeInteger(order.discount) ||
        order.discount < 0 ||
        order.discount > order.subtotal + order.deliveryFee
      ) {
        this.fail("Invalid discount");
      }

      // ==================== Calculate Total Amount ====================

      assertAmount(order.subtotal + order.deliveryFee);

      order.totalAmount =
        order.subtotal + order.deliveryFee - order.discount;

      if (!Number.isSafeInteger(order.totalAmount)) {
        this.fail("Invalid order amount");
      }

      // ==================== Update Order Information ====================

      order.updatedBy = user._id;

      await order.save({ session });

      // ==================== Save Order Update History ====================

      await this.saveHistory({
        order,
        fromStatus: order.status,
        toStatus: order.status,
        user,
        reason: "Order updated",
        session,
      });

      return {
        order: this.serialize(order),
      };
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