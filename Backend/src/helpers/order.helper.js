const input = require("./orderInput.helper");
const { integer: assertAmount } = input;
const crypto = require("node:crypto");
const mongoose = require("mongoose");

const Order = require("../models/order.model");
const OrderReturn = require("../models/orderReturn.model");
const OrderStatusHistory = require("../models/orderStatusHistory.model");
const ProductVariant = require("../models/productVariant.model");
const Product = require("../models/product.model");

const inventoryHelper = require("./inventory.helper");
const runTransaction = require("./transaction.helper");

// ==================== Order Helper ====================

class OrderHelper {

  // ==================== Ensure Idempotency Indexes ====================

  ensureIndexes = async () => {
    if (!this.indexesReady) {
      this.indexesReady = Promise.all([Order.createIndexes(), OrderReturn.createIndexes()]).catch((error) => {
        this.indexesReady = null;
        throw error;
      });
    }
    await this.indexesReady;
  };

  // ==================== Error Handler ====================

  fail = (message, statusCode = 400) => {
    throw Object.assign(new Error(message), { statusCode });
  };

  // ==================== Roles ====================

  isAdmin = (user) => ["superadmin", "manager"].includes(user.role);

  isFollowUp = (user) => ["superadmin", "manager", "saler", "follow-up"].includes(user.role);

  // ==================== Order Scope ====================

  scope = (user) => {
    if (this.isAdmin(user)) return {};

    if (user.role === "saler") {
      return { createdBy: user._id };
    }

    if (user.role === "follow-up") {
      return {
        status: {
          $in: ["Prepared", "Out For Delivery", "Delivered", "Returned", "Partially Returned"],
        },
      };
    }

    return { _id: { $in: [] } };
  };

  // ==================== Serialize Order ====================

  serialize = (order) => {
    if (!order) return null;
    const value = typeof order.toObject === "function" ? order.toObject({ virtuals: true }) : { ...order };
    delete value.idempotencyKey;
    delete value.idempotencyHash;
    return value;
  };

  // ==================== Idempotency Hash ====================

  createHash = (body) => {
    return crypto.createHash("sha256").update(JSON.stringify(body)).digest("hex");
  };

  // ==================== Generate Order Number ====================

  generateOrderNumber = () => {
    return `ORD-${crypto.randomUUID().replace(/-/g, "").slice(0, 16).toUpperCase()}`;
  };

  // ==================== Check Order Access ====================

  getAccessibleOrder = async (user, id, session) => {
    if (!mongoose.isValidObjectId(id)) this.fail("Invalid order ID");

    const order = await Order.findOne({
      $and: [{ _id: id }, this.scope(user)],
    }).session(session);

    if (!order) this.fail("Order not found", 404);

    return order;
  };

  // ==================== Save Status History ====================

  saveHistory = async ({ order, fromStatus, toStatus, user, reason, note, session }) => {
    const history = new OrderStatusHistory({
      order: order._id,
      fromStatus,
      toStatus,
      changedBy: user._id,
      reason,
      note,
    });

    return history.save({ session });
  };

  // ==================== Change Order Status ====================

  changeStatus = async ({ user, id, fromStatus, toStatus, body = {}, changes = {} }) => {
    body = input.action(body);
    return runTransaction(async (session) => {
      const order = await this.getAccessibleOrder(user, id, session);

      if (order.status !== fromStatus) {
        this.fail(`Order must be ${fromStatus} to perform this action`, 409);
      }

      Object.assign(order, { status: toStatus, ...changes, updatedBy: user._id });
      const updated = await order.save({ session });

      await this.saveHistory({
        order,
        fromStatus,
        toStatus,
        user,
        note: body.note,
        reason: body.reason,
        session,
      });

      return { order: this.serialize(updated) };
    });
  };

  // ==================== Validate Items ====================

  validateItems = (items) => {
    if (!Array.isArray(items) || !items.length) {
      this.fail("Order must contain at least one item");
    }

    const variants = new Set();

    for (const item of items) {
      if (!mongoose.isValidObjectId(item.variant)) {
        this.fail("Invalid product variant");
      }

      if (!Number.isSafeInteger(item.quantity) || item.quantity < 1) {
        this.fail("Invalid item quantity");
      }

      if (!Number.isSafeInteger(item.unitPrice) || item.unitPrice < 0) {
        this.fail("Invalid item price");
      }

      const id = String(item.variant);

      if (variants.has(id)) {
        this.fail("Duplicate variant in order");
      }

      variants.add(id);
    }
  };

  // ==================== Validate Customer ====================

  validateCustomer = (customer) => {
    if (!customer || !customer.name?.trim() || !customer.address?.trim()) {
      this.fail("Customer name and address are required");
    }

    if (!customer.phone?.trim() && !customer.instagramUsername?.trim()) {
      this.fail("Customer phone or Instagram username is required");
    }
  };

  // ==================== Get Existing Order ====================

  getExistingOrder = async (user, key, hash) => {
    if (!key) return null;

    const order = await Order.findOne({
      createdBy: user._id,
      idempotencyKey: key,
    });

    if (!order) return null;

    if (order.idempotencyHash !== hash) {
      this.fail("Idempotency key already used with different data", 409);
    }

    return { order: this.serialize(order), replayed: true };
  };

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
        const replay = await Order.findOne({ createdBy: user._id, idempotencyKey: key }).session(session);
        if (replay) {
          if (replay.idempotencyHash !== hash) this.fail("Idempotency key already used with different data", 409);
          return { order: this.serialize(replay), replayed: true };
        }
        const orderItems = [];
        let subtotal = 0;

        // ==================== Prepare Order Items ====================

        for (const item of body.items) {
          const variant = await ProductVariant.findOne({
            _id: item.variant,
            isActive: true,
          }).session(session);

          if (!variant) this.fail("Active product variant not found", 404);

          const product = await Product.findOne({
            _id: variant.product,
            isActive: true,
          }).session(session);

          if (!product) this.fail("Active product not found", 404);

          const totalPrice = item.quantity * item.unitPrice;

          if (!Number.isSafeInteger(totalPrice)) {
            this.fail("Invalid item total price");
          }

          subtotal += totalPrice;
          assertAmount(subtotal);

          orderItems.push({
            product: product._id,
            variant: variant._id,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalPrice,
            productSnapshot: {
              name: product.name,
              modelCode: product.modelCode,
              color: variant.color,
              size: variant.size,
              sku: variant.sku,
            },
          });
        }

        // ==================== Calculate Amount ====================

        const deliveryFee = body.deliveryFee ?? 0;
        const discount = body.discount ?? 0;

        if (!Number.isSafeInteger(deliveryFee) || deliveryFee < 0) {
          this.fail("Invalid delivery fee");
        }

        if (!Number.isSafeInteger(discount) || discount < 0 || discount > subtotal + deliveryFee) {
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
          notes: body.notes,
          createdBy: user._id,
          updatedBy: user._id,
          ...(key && { idempotencyKey: key, idempotencyHash: hash }),
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

        // ==================== Save History ====================

        await this.saveHistory({
          order,
          fromStatus: null,
          toStatus: "New",
          user,
          session,
        });

        return { order: this.serialize(order), replayed: false };
      });
    } catch (error) {
      if (error.code === 11000 && key) {
        const replay = await this.getExistingOrder(user, key, hash);
        if (replay) return replay;
      }

      throw error;
    }
  };

  // ==================== Update Order ====================

  updateOrder = async ({ user, id, body }) => {
    if (!["superadmin", "manager", "saler"].includes(user.role)) this.fail("Permission denied", 403);
    body = input.order(body, true);
    return runTransaction(async (session) => {
      const order = await this.getAccessibleOrder(user, id, session);

      if (!["New", "Preparing"].includes(order.status)) {
        this.fail("Order cannot be updated at this stage", 409);
      }

      if (!this.isAdmin(user) && String(order.createdBy) !== String(user._id)) {
        this.fail("Permission denied", 403);
      }

      // ==================== Update Customer And Notes ====================

      if (body.customer !== undefined) {
        this.validateCustomer(body.customer);
        order.customer = body.customer;
      }

      if (body.notes !== undefined) {
        order.notes = body.notes;
      }

      // ==================== Update Items ====================

      if (body.items !== undefined) {
        this.validateItems(body.items);

        const oldItems = order.items;
        const newItems = [];
        let subtotal = 0;

        for (const input of body.items) {
          const variant = await ProductVariant.findOne({
            _id: input.variant,
            isActive: true,
          }).session(session);

          if (!variant) this.fail("Active product variant not found", 404);

          const product = await Product.findOne({
            _id: variant.product,
            isActive: true,
          }).session(session);

          if (!product) this.fail("Active product not found", 404);

          const previous = oldItems.find((item) => String(item.variant) === String(variant._id));
          const itemId = previous?._id ?? new mongoose.Types.ObjectId();
          const oldQuantity = previous?.quantity ?? 0;
          const difference = input.quantity - oldQuantity;

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

          const totalPrice = input.quantity * input.unitPrice;
          if (!Number.isSafeInteger(totalPrice)) this.fail("Invalid item total price");

          subtotal += totalPrice;
          assertAmount(subtotal);

          newItems.push({
            _id: itemId,
            product: product._id,
            variant: variant._id,
            quantity: input.quantity,
            unitPrice: input.unitPrice,
            totalPrice,
            productSnapshot: {
              name: product.name,
              modelCode: product.modelCode,
              color: variant.color,
              size: variant.size,
              sku: variant.sku,
            },
          });
        }

        // ==================== Release Removed Items ====================

        for (const previous of oldItems) {
          const exists = newItems.some((item) => String(item.variant) === String(previous.variant));

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

        order.items = newItems;
        order.subtotal = subtotal;
      }

      // ==================== Update Amount ====================

      if (body.deliveryFee !== undefined) order.deliveryFee = body.deliveryFee;
      if (body.discount !== undefined) order.discount = body.discount;

      if (!Number.isSafeInteger(order.deliveryFee) || order.deliveryFee < 0) {
        this.fail("Invalid delivery fee");
      }

      if (!Number.isSafeInteger(order.discount) || order.discount < 0 || order.discount > order.subtotal + order.deliveryFee) {
        this.fail("Invalid discount");
      }

      assertAmount(order.subtotal + order.deliveryFee);
      order.totalAmount = order.subtotal + order.deliveryFee - order.discount;
      order.updatedBy = user._id;
      await order.save({ session });
      await this.saveHistory({ order, fromStatus: order.status, toStatus: order.status, user, reason: "Order updated", session });

      return { order: this.serialize(order) };
    });
  };

  // ==================== Cancel Order ====================

  cancelOrder = async ({ user, id, body = {} }) => {
    if (!["superadmin", "manager", "saler"].includes(user.role)) this.fail("Permission denied", 403);
    body = input.action(body, true);
    return runTransaction(async (session) => {
      const order = await this.getAccessibleOrder(user, id, session);

      if (order.status === "Cancelled") {
        return { order: this.serialize(order), replayed: true };
      }

      if (!["New", "Preparing", "Prepared"].includes(order.status)) {
        this.fail("Order cannot be cancelled after dispatch", 409);
      }

      if (!this.isAdmin(user) && String(order.createdBy) !== String(user._id)) {
        this.fail("Permission denied", 403);
      }

      const fromStatus = order.status;

      // ==================== Release Reserved Stock ====================

      for (const item of order.items) {
        await inventoryHelper.releaseReservedStock({
          variantId: item.variant,
          quantity: item.quantity,
          order: order._id,
          orderItem: item._id,
          performedBy: user._id,
          reason: body.reason || "Order cancelled",
          session,
        });

        item.cancelledQuantity = item.quantity;
      }

      // ==================== Update Order ====================

      order.status = "Cancelled";
      order.cancelledAt = new Date();
      order.cancelledBy = user._id;
      order.updatedBy = user._id;
      order.followUpCompleted = true;

      await order.save({ session });

      await this.saveHistory({
        order,
        fromStatus,
        toStatus: "Cancelled",
        user,
        reason: body.reason,
        note: body.note,
        session,
      });

      return { order: this.serialize(order), replayed: false };
    });
  };

  // ==================== Start Preparing ====================

  startPreparing = async ({ user, id, body = {} }) => {
    if (!this.isAdmin(user)) this.fail("Permission denied", 403);

    return this.changeStatus({
      user,
      id,
      fromStatus: "New",
      toStatus: "Preparing",
      body,
    });
  };

  // ==================== Mark Prepared ====================

  markPrepared = async ({ user, id, body = {} }) => {
    if (!this.isAdmin(user)) this.fail("Permission denied", 403);

    return this.changeStatus({
      user,
      id,
      fromStatus: "Preparing",
      toStatus: "Prepared",
      body,
      changes: {
        preparedBy: user._id,
        preparedAt: new Date(),
      },
    });
  };

  // ==================== Dispatch Order ====================

  dispatchOrder = async ({ user, id, body = {} }) => {
    body = input.action(body);
    if (!this.isAdmin(user)) this.fail("Permission denied", 403);

    return runTransaction(async (session) => {
      const order = await this.getAccessibleOrder(user, id, session);

      if (order.status !== "Prepared") {
        this.fail("Only prepared orders can be dispatched", 409);
      }

      // ==================== Confirm Stock Out ====================

      for (const item of order.items) {
        await inventoryHelper.confirmSale({
          variantId: item.variant,
          quantity: item.quantity,
          order: order._id,
          orderItem: item._id,
          performedBy: user._id,
          reason: "Order dispatched for delivery",
          session,
        });

        item.dispatchedQuantity = item.quantity;
      }

      // ==================== Update Order ====================

      order.status = "Out For Delivery";
      order.dispatchedBy = user._id;
      order.dispatchedAt = new Date();
      order.updatedBy = user._id;

      await order.save({ session });

      await this.saveHistory({
        order,
        fromStatus: "Prepared",
        toStatus: "Out For Delivery",
        user,
        note: body.note,
        session,
      });

      return { order: this.serialize(order) };
    });
  };

  // ==================== Deliver Order ====================

  deliverOrder = async ({ user, id, body = {} }) => {
    if (!this.isFollowUp(user)) this.fail("Permission denied", 403);
    body = input.action(body);
    return runTransaction(async (session) => {
      const order = await this.getAccessibleOrder(user, id, session);
      if (!["Out For Delivery", "Partially Returned", "Delivered"].includes(order.status)) this.fail("Order must be dispatched with remaining items", 409);
      const pending = order.items.some((item) => item.dispatchedQuantity > item.returnedQuantity + item.deliveredQuantity);
      if (!pending) return { order: this.serialize(order), replayed: true };
      const fromStatus = order.status;
      for (const item of order.items) item.deliveredQuantity = item.dispatchedQuantity - item.returnedQuantity;
      order.deliveredAmount = order.items.reduce((sum, item) => sum + item.deliveredQuantity * item.unitPrice, 0);
      order.status = order.items.some((item) => item.returnedQuantity > 0) ? "Partially Returned" : "Delivered";
      order.completedBy = user._id;
      order.completedAt = new Date();
      order.followUpCompleted = true;
      order.updatedBy = user._id;
      await order.save({ session });
      await this.saveHistory({ order, fromStatus, toStatus: order.status, user, note: body.note, session });
      return { order: this.serialize(order), replayed: false };
    });
  };

  // ==================== Return Order Items ====================

  returnOrderItems = async ({ user, id, body, key }) => {
    if (!this.isFollowUp(user)) this.fail("Permission denied", 403);

    body = input.returns(body);
    key = input.key(key);
    input.id(id);
    await this.ensureIndexes();
    if (!Array.isArray(body.items) || !body.items.length) {
      this.fail("Return items are required");
    }

    const reasons = ["NO_ANSWER", "REFUSED", "WRONG_ADDRESS", "CHANGED_MIND", "SIZE_ISSUE", "DAMAGED", "OTHER"];

    if (!reasons.includes(body.reason)) {
      this.fail("Invalid return reason");
    }

    const hash = this.createHash(body);

    // ==================== Check Existing Return ====================

    if (key) {
      const existing = await OrderReturn.findOne({ order: id, idempotencyKey: key });

      if (existing) {
        if (existing.idempotencyHash !== hash) {
          this.fail("Idempotency key already used with different data", 409);
        }

        const order = await this.getAccessibleOrder(user, id, null);

        return {
          order: this.serialize(order),
          orderReturn: this.serialize(existing),
          replayed: true,
        };
      }
    }

    try {
      return await runTransaction(async (session) => {
        const order = await this.getAccessibleOrder(user, id, session);

        const existing = await OrderReturn.findOne({ order: id, idempotencyKey: key }).session(session);
        if (existing) {
          if (existing.idempotencyHash !== hash) this.fail("Idempotency key already used with different data", 409);
          return { order: this.serialize(order), orderReturn: this.serialize(existing), replayed: true };
        }
        if (!["Out For Delivery", "Delivered", "Partially Returned"].includes(order.status)) {
          this.fail("Order must be dispatched before returning items", 409);
        }

        const returnedItems = [];
        const usedItems = new Set();
        let returnedAmount = 0;

        // ==================== Validate Return Items ====================

        for (const input of body.items) {
          const itemId = String(input.orderItem);

          if (usedItems.has(itemId)) {
            this.fail("Duplicate order item in return");
          }

          usedItems.add(itemId);

          const item = order.items.id(itemId);

          if (!item) this.fail("Order item not found", 404);

          if (!Number.isSafeInteger(input.quantity) || input.quantity < 1) {
            this.fail("Invalid return quantity");
          }

          if (input.quantity > item.dispatchedQuantity - item.returnedQuantity) {
            this.fail("Return quantity exceeds remaining dispatched quantity", 409);
          }

          const totalPrice = input.quantity * item.unitPrice;

          returnedAmount += totalPrice;

          returnedItems.push({
            orderItem: item._id,
            variant: item.variant,
            quantity: input.quantity,
            unitPrice: item.unitPrice,
            totalPrice,
          });
        }

        // ==================== Create Return ====================

        const totalQuantity = order.items.reduce((sum, item) => sum + BigInt(item.dispatchedQuantity), 0n);
        const returnQuantity = returnedItems.reduce((sum, item) => sum + BigInt(item.quantity), 0n);
        const cumulativeReturned = order.items.reduce((sum, item) => sum + BigInt(item.returnedQuantity), 0n) + returnQuantity;

        const orderReturn = new OrderReturn({
          order: order._id,
          items: returnedItems,
          type: cumulativeReturned === totalQuantity ? "FULL" : "PARTIAL",
          reason: body.reason,
          note: body.note,
          returnedAmount,
          processedBy: user._id,
          ...(key && { idempotencyKey: key, idempotencyHash: hash }),
        });

        await orderReturn.save({ session });

        // ==================== Restore Returned Stock ====================

        for (const returned of returnedItems) {
          const item = order.items.id(returned.orderItem);

          await inventoryHelper.returnStock({
            variantId: item.variant,
            quantity: returned.quantity,
            order: order._id,
            orderItem: item._id,
            performedBy: user._id,
            reason: body.reason,
            note: body.note,
            session,
          });

          item.returnedQuantity += returned.quantity;
          item.deliveredQuantity = Math.min(item.deliveredQuantity, item.dispatchedQuantity - item.returnedQuantity);
        }

        // ==================== Update Order Totals ====================

        const fromStatus = order.status;

        order.returnedAmount = order.items.reduce(
          (sum, item) => sum + item.returnedQuantity * item.unitPrice,
          0,
        );

        order.deliveredAmount = order.items.reduce(
          (sum, item) => sum + item.deliveredQuantity * item.unitPrice,
          0,
        );

        order.status = cumulativeReturned === totalQuantity ? "Returned" : "Partially Returned";
        order.followUpCompleted = order.items.every((item) => item.returnedQuantity + item.deliveredQuantity === item.dispatchedQuantity);
        if (order.followUpCompleted && !order.completedAt) {
          order.completedBy = user._id;
          order.completedAt = new Date();
        }
        order.updatedBy = user._id;

        await order.save({ session });

        // ==================== Save Status History ====================

        await this.saveHistory({
          order,
          fromStatus,
          toStatus: order.status,
          user,
          reason: body.reason,
          note: body.note,
          session,
        });

        return {
          order: this.serialize(order),
          orderReturn: this.serialize(orderReturn),
          replayed: false,
        };
      });
    } catch (error) {
      if (error.code === 11000 && key) {
        const existing = await OrderReturn.findOne({ order: id, idempotencyKey: key });

        if (existing) {
          if (existing.idempotencyHash !== hash) this.fail("Idempotency key already used with different data", 409);
          const order = await this.getAccessibleOrder(user, id, null);

          return {
            order: this.serialize(order),
            orderReturn: this.serialize(existing),
            replayed: true,
          };
        }
      }

      throw error;
    }
  };
}

// ==================== Export Helper ====================

module.exports = new OrderHelper();

