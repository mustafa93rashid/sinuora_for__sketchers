const { lockProduct } = require("./catalog.helper");

const crypto = require("node:crypto");
const mongoose = require("mongoose");

const input = require("./orderInput.helper");

const Order = require("../models/order.model");
const OrderReturn = require("../models/orderReturn.model");
const OrderStatusHistory = require("../models/orderStatusHistory.model");
const ProductVariant = require("../models/productVariant.model");

const inventoryHelper = require("./inventory.helper");
const runTransaction = require("./transaction.helper");

// ==================== Order Helper ====================

class OrderHelper {
  // ==================== Error Handler ====================

  fail = (message, statusCode = 400) => {
    throw Object.assign(new Error(message), { statusCode });
  };

  // ==================== Ensure Indexes ====================

  ensureIndexes = async () => {
    if (!this.indexesReady) {
      this.indexesReady = Promise.all([
        Order.createIndexes(),
        OrderReturn.createIndexes(),
      ]).catch((error) => {
        this.indexesReady = null;
        throw error;
      });
    }

    await this.indexesReady;
  };

  // ==================== Roles ====================

  isAdmin = (user) =>
    ["superadmin", "manager"].includes(user?.role);

  isFollowUp = (user) =>
    ["superadmin", "manager", "saler", "follow-up"].includes(user?.role);

  canCreateOrder = (user) =>
    ["superadmin", "manager", "saler"].includes(user?.role);

  // ==================== Order Scope ====================

  scope = (user) => {
    if (this.isAdmin(user)) return {};

    if (user?.role === "saler") {
      return { createdBy: user._id };
    }

    if (user?.role === "follow-up") {
      return {
        status: {
          $in: [
            "Prepared",
            "Out For Delivery",
            "Delivered",
            "Returned",
            "Partially Returned",
          ],
        },
      };
    }

    return { _id: { $in: [] } };
  };

  // ==================== Serialize Document ====================

  serialize = (document, user = null) => {
    if (!document) return null;

    const value =
      typeof document.toObject === "function"
        ? document.toObject({ virtuals: true })
        : JSON.parse(JSON.stringify(document));

    delete value.idempotencyKey;
    delete value.idempotencyHash;

    // ==================== Protect Cost Information ====================

    if (!this.isAdmin(user) && Array.isArray(value.items)) {
      for (const item of value.items) {
        delete item.unitCost;
        delete item.totalCost;
      }
    }

    return value;
  };

  // ==================== Idempotency Hash ====================

  createHash = (body) =>
    crypto
      .createHash("sha256")
      .update(JSON.stringify(body))
      .digest("hex");

  // ==================== Generate Order Number ====================

  generateOrderNumber = () =>
    `ORD-${crypto.randomUUID()
      .replace(/-/g, "")
      .slice(0, 16)
      .toUpperCase()}`;

  // ==================== Validate Amount ====================

  validateAmount = (amount, label = "Amount") => {
    if (!Number.isSafeInteger(amount) || amount < 0) {
      this.fail(`Invalid ${label}`, 400);
    }

    return amount;
  };

  multiplyAmount = (quantity, price, label = "Amount") =>
    this.validateAmount(quantity * price, label);

  sumAmount = (current, value, label = "Amount") =>
    this.validateAmount(current + value, label);

  // ==================== Product Cost ====================

  getProductCost = (product) => {
    const cost = product.costPrice;

    if (!Number.isSafeInteger(cost) || cost < 0) {
      this.fail("Product cost price is invalid", 409);
    }

    return cost;
  };

  // ==================== Validate Items ====================

  validateItems = (items) => {
    if (!Array.isArray(items) || !items.length || items.length > 100) {
      this.fail("Order must contain between 1 and 100 items");
    }

    const variants = new Set();

    for (const item of items) {
      if (!mongoose.isValidObjectId(item.variant)) {
        this.fail("Invalid product variant");
      }

      this.validateAmount(item.quantity, "item quantity");

      if (item.quantity < 1) {
        this.fail("Item quantity must be greater than zero");
      }

      this.validateAmount(item.unitPrice, "item price");

      const variantId = String(item.variant);

      if (variants.has(variantId)) {
        this.fail("Duplicate variant in order");
      }

      variants.add(variantId);
    }
  };

  // ==================== Validate Customer ====================

  validateCustomer = (customer) => {
    if (!customer?.name?.trim() || !customer?.address?.trim()) {
      this.fail("Customer name and address are required");
    }

    if (
      !customer.phone?.trim() &&
      !customer.instagramUsername?.trim()
    ) {
      this.fail("Customer phone or Instagram username is required");
    }
  };

  // ==================== Accessible Order ====================

  getAccessibleOrder = async (user, id, session = null) => {
    if (!mongoose.isValidObjectId(id)) {
      this.fail("Invalid order ID");
    }

    const order = await Order.findOne({
      $and: [{ _id: id }, this.scope(user)],
    }).session(session);

    if (!order) {
      this.fail("Order not found", 404);
    }

    return order;
  };

  // ==================== Save Status History ====================

  saveHistory = async ({
    order,
    fromStatus,
    toStatus,
    user,
    reason,
    note,
    session,
  }) => {
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

  // ==================== Get Existing Order ====================

  getExistingOrder = async (user, key, hash) => {
    const order = await Order.findOne({
      createdBy: user._id,
      idempotencyKey: key,
    });

    if (!order) return null;

    if (order.idempotencyHash !== hash) {
      this.fail(
        "Idempotency key already used with different data",
        409
      );
    }

    return {
      order: this.serialize(order, user),
      replayed: true,
    };
  };

  // ==================== Prepare Order Item ====================

  prepareOrderItem = async ({
    item,
    previous = null,
    session,
  }) => {
    const variant = await ProductVariant.findOne({
      _id: item.variant,
      isActive: true,
    }).session(session);

    if (!variant) {
      this.fail("Active product variant not found", 404);
    }

    const product = await lockProduct(variant.product, session);

    if (!product) {
      this.fail("Active product not found", 404);
    }

    // ==================== Historical Cost Snapshot ====================

    let unitCost = null;

    if (previous) {
      // Preserve the original historical cost.
      // Do not replace missing old cost with current product cost.

      if (previous.unitCost != null) {
        unitCost = this.validateAmount(
          previous.unitCost,
          "historical unit cost"
        );
      }
    } else {
      unitCost = this.getProductCost(product);
    }

    // ==================== Calculate Selling Amount ====================

    const totalPrice = this.multiplyAmount(
      item.quantity,
      item.unitPrice,
      "item total price"
    );

    // ==================== Calculate Historical Cost ====================

    const totalCost =
      unitCost === null
        ? null
        : this.multiplyAmount(
            item.quantity,
            unitCost,
            "item total cost"
          );

    // ==================== Product Snapshot ====================

    const productSnapshot = previous?.productSnapshot
      ? {
          name: previous.productSnapshot.name,
          modelCode: previous.productSnapshot.modelCode,
          color: previous.productSnapshot.color,
          size: previous.productSnapshot.size,
          sku: previous.productSnapshot.sku,
        }
      : {
          name: product.name,
          modelCode: product.modelCode,
          color: variant.color,
          size: variant.size,
          sku: variant.sku,
        };

    return {
      _id: previous?._id ?? new mongoose.Types.ObjectId(),
      product: product._id,
      variant: variant._id,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      totalPrice,
      unitCost,
      totalCost,
      productSnapshot,
    };
  };

  // ==================== Calculate Order Totals ====================

  calculateTotals = (order) => {
    order.subtotal = order.items.reduce(
      (sum, item) =>
        this.sumAmount(sum, item.totalPrice, "subtotal"),
      0
    );

    this.validateAmount(order.deliveryFee, "delivery fee");
    this.validateAmount(order.discount, "discount");

    const beforeDiscount = this.sumAmount(
      order.subtotal,
      order.deliveryFee,
      "order amount"
    );

    if (order.discount > beforeDiscount) {
      this.fail("Discount exceeds order amount");
    }

    order.totalAmount = beforeDiscount - order.discount;
  };

  // ==================== Calculate Follow-up Amounts ====================

  calculateFollowUpAmounts = (order) => {
    order.deliveredAmount = 0;
    order.returnedAmount = 0;

    for (const item of order.items) {
      order.deliveredAmount = this.sumAmount(
        order.deliveredAmount,
        this.multiplyAmount(
          item.deliveredQuantity,
          item.unitPrice,
          "delivered amount"
        ),
        "delivered amount"
      );

      order.returnedAmount = this.sumAmount(
        order.returnedAmount,
        this.multiplyAmount(
          item.returnedQuantity,
          item.unitPrice,
          "returned amount"
        ),
        "returned amount"
      );
    }
  };

  // ==================== Create Order ====================

  createOrder = async ({ user, body, key }) => {
    if (!this.canCreateOrder(user)) {
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

        const replay = await Order.findOne({
          createdBy: user._id,
          idempotencyKey: key,
        }).session(session);

        if (replay) {
          if (replay.idempotencyHash !== hash) {
            this.fail(
              "Idempotency key already used with different data",
              409
            );
          }

          return {
            order: this.serialize(replay, user),
            replayed: true,
          };
        }

        // ==================== Prepare Items ====================

        const orderItems = [];

        for (const item of body.items) {
          orderItems.push(
            await this.prepareOrderItem({
              item,
              session,
            })
          );
        }

        // ==================== Create Order Document ====================

        const order = new Order({
          orderNumber: this.generateOrderNumber(),
          customer: body.customer,
          items: orderItems,
          status: "New",
          deliveryFee: body.deliveryFee ?? 0,
          discount: body.discount ?? 0,
          notes: body.notes,
          createdBy: user._id,
          updatedBy: user._id,
          idempotencyKey: key,
          idempotencyHash: hash,
        });

        this.calculateTotals(order);

        await order.save({ session });

        // ==================== Reserve Inventory ====================

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

        // ==================== Save Status History ====================

        await this.saveHistory({
          order,
          fromStatus: null,
          toStatus: "New",
          user,
          session,
        });

        return {
          order: this.serialize(order, user),
          replayed: false,
        };
      });
    } catch (error) {
      if (error.code === 11000) {
        const replay = await this.getExistingOrder(
          user,
          key,
          hash
        );

        if (replay) return replay;
      }

      throw error;
    }
  };

  // ==================== Update Order ====================

  updateOrder = async ({ user, id, body }) => {
    if (!this.canCreateOrder(user)) {
      this.fail("Permission denied", 403);
    }

    body = input.order(body, true);

    return runTransaction(async (session) => {
      const order = await this.getAccessibleOrder(
        user,
        id,
        session
      );

      if (!["New", "Preparing"].includes(order.status)) {
        this.fail("Order cannot be updated at this stage", 409);
      }

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

      // ==================== Update Items ====================

      if (body.items !== undefined) {
        this.validateItems(body.items);

        const oldItems = [...order.items];
        const newItems = [];

        for (const item of body.items) {
          const previous = oldItems.find(
            (old) =>
              String(old.variant) === String(item.variant)
          );

          const prepared = await this.prepareOrderItem({
            item,
            previous,
            session,
          });

          const difference =
            item.quantity - (previous?.quantity ?? 0);

          // ==================== Reserve Increased Quantity ====================

          if (difference > 0) {
            await inventoryHelper.reserveStock({
              variantId: item.variant,
              quantity: difference,
              order: order._id,
              orderItem: prepared._id,
              performedBy: user._id,
              reason: "Order quantity increased",
              session,
            });
          }

          // ==================== Release Decreased Quantity ====================

          if (difference < 0) {
            await inventoryHelper.releaseReservedStock({
              variantId: item.variant,
              quantity: Math.abs(difference),
              order: order._id,
              orderItem: prepared._id,
              performedBy: user._id,
              reason: "Order quantity decreased",
              session,
            });
          }

          newItems.push(prepared);
        }

        // ==================== Release Removed Items ====================

        for (const previous of oldItems) {
          const exists = newItems.some(
            (item) =>
              String(item.variant) ===
              String(previous.variant)
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

        order.items = newItems;
      }

      // ==================== Update Financial Amounts ====================

      if (body.deliveryFee !== undefined) {
        order.deliveryFee = body.deliveryFee;
      }

      if (body.discount !== undefined) {
        order.discount = body.discount;
      }

      this.calculateTotals(order);

      order.updatedBy = user._id;

      await order.save({ session });

      // ==================== Save Update History ====================

      await this.saveHistory({
        order,
        fromStatus: order.status,
        toStatus: order.status,
        user,
        reason: "Order updated",
        session,
      });

      return {
        order: this.serialize(order, user),
      };
    });
  };

  // ==================== Change Order Status ====================

  changeStatus = async ({
    user,
    id,
    fromStatus,
    toStatus,
    body = {},
    changes = {},
  }) => {
    body = input.action(body);

    return runTransaction(async (session) => {
      const order = await this.getAccessibleOrder(
        user,
        id,
        session
      );

      if (order.status !== fromStatus) {
        this.fail(`Order must be ${fromStatus}`, 409);
      }

      Object.assign(order, {
        status: toStatus,
        ...changes,
        updatedBy: user._id,
      });

      await order.save({ session });

      await this.saveHistory({
        order,
        fromStatus,
        toStatus,
        user,
        reason: body.reason,
        note: body.note,
        session,
      });

      return {
        order: this.serialize(order, user),
      };
    });
  };

  // ==================== Cancel Order ====================

  cancelOrder = async ({ user, id, body = {} }) => {
    if (!this.canCreateOrder(user)) {
      this.fail("Permission denied", 403);
    }

    body = input.action(body, true);

    return runTransaction(async (session) => {
      const order = await this.getAccessibleOrder(
        user,
        id,
        session
      );

      // ==================== Already Cancelled ====================

      if (order.status === "Cancelled") {
        return {
          order: this.serialize(order, user),
          replayed: true,
        };
      }

      if (
        !["New", "Preparing", "Prepared"].includes(
          order.status
        )
      ) {
        this.fail(
          "Order cannot be cancelled after dispatch",
          409
        );
      }

      if (
        !this.isAdmin(user) &&
        String(order.createdBy) !== String(user._id)
      ) {
        this.fail("Permission denied", 403);
      }

      const fromStatus = order.status;

      // ==================== Release Reserved Inventory ====================

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

      // ==================== Save Cancellation History ====================

      await this.saveHistory({
        order,
        fromStatus,
        toStatus: "Cancelled",
        user,
        reason: body.reason,
        note: body.note,
        session,
      });

      return {
        order: this.serialize(order, user),
        replayed: false,
      };
    });
  };

  // ==================== Start Preparing ====================

  startPreparing = async ({ user, id, body = {} }) => {
    if (!this.isAdmin(user)) {
      this.fail("Permission denied", 403);
    }

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
    if (!this.isAdmin(user)) {
      this.fail("Permission denied", 403);
    }

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
    if (!this.isAdmin(user)) {
      this.fail("Permission denied", 403);
    }

    body = input.action(body);

    return runTransaction(async (session) => {
      const order = await this.getAccessibleOrder(
        user,
        id,
        session
      );

      if (order.status !== "Prepared") {
        this.fail(
          "Only prepared orders can be dispatched",
          409
        );
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

      // ==================== Save Dispatch History ====================

      await this.saveHistory({
        order,
        fromStatus: "Prepared",
        toStatus: "Out For Delivery",
        user,
        note: body.note,
        session,
      });

      return {
        order: this.serialize(order, user),
      };
    });
  };

  // ==================== Deliver Order ====================

  deliverOrder = async ({ user, id, body = {} }) => {
    if (!this.isFollowUp(user)) {
      this.fail("Permission denied", 403);
    }

    body = input.action(body);

    return runTransaction(async (session) => {
      const order = await this.getAccessibleOrder(
        user,
        id,
        session
      );

      if (
        ![
          "Out For Delivery",
          "Partially Returned",
          "Delivered",
        ].includes(order.status)
      ) {
        this.fail(
          "Order must be dispatched before delivery",
          409
        );
      }

      // ==================== Check Pending Quantities ====================

      const pending = order.items.some(
        (item) =>
          item.dispatchedQuantity >
          item.returnedQuantity +
            item.deliveredQuantity
      );

      if (!pending) {
        return {
          order: this.serialize(order, user),
          replayed: true,
        };
      }

      const fromStatus = order.status;

      // ==================== Confirm Remaining Delivery ====================

      for (const item of order.items) {
        item.deliveredQuantity =
          item.dispatchedQuantity -
          item.returnedQuantity;
      }

      this.calculateFollowUpAmounts(order);

      // ==================== Determine Final Status ====================

      const hasReturns = order.items.some(
        (item) => item.returnedQuantity > 0
      );

      order.status = hasReturns
        ? "Partially Returned"
        : "Delivered";

      order.completedBy = user._id;
      order.completedAt = new Date();
      order.followUpCompleted = true;
      order.updatedBy = user._id;

      await order.save({ session });

      // ==================== Save Delivery History ====================

      await this.saveHistory({
        order,
        fromStatus,
        toStatus: order.status,
        user,
        note: body.note,
        session,
      });

      return {
        order: this.serialize(order, user),
        replayed: false,
      };
    });
  };

  // ==================== Return Order Items ====================

  returnOrderItems = async ({ user, id, body, key }) => {
    if (!this.isFollowUp(user)) {
      this.fail("Permission denied", 403);
    }

    body = input.returns(body);
    key = input.key(key);
    id = input.id(id);

    await this.ensureIndexes();

    const hash = this.createHash(body);

    // ==================== Get Existing Return ====================

    const getExistingReturn = async () => {
      const existing = await OrderReturn.findOne({
        order: id,
        idempotencyKey: key,
      });

      if (!existing) return null;

      if (existing.idempotencyHash !== hash) {
        this.fail(
          "Idempotency key already used with different data",
          409
        );
      }

      const order = await this.getAccessibleOrder(user, id);

      return {
        order: this.serialize(order, user),
        orderReturn: this.serialize(existing, user),
        replayed: true,
      };
    };

    // ==================== Check Idempotency ====================

    const replay = await getExistingReturn();

    if (replay) return replay;

    try {
      return await runTransaction(async (session) => {
        const order = await this.getAccessibleOrder(
          user,
          id,
          session
        );

        // ==================== Check Existing Return In Transaction ====================

        const existing = await OrderReturn.findOne({
          order: id,
          idempotencyKey: key,
        }).session(session);

        if (existing) {
          if (existing.idempotencyHash !== hash) {
            this.fail(
              "Idempotency key already used with different data",
              409
            );
          }

          return {
            order: this.serialize(order, user),
            orderReturn: this.serialize(existing, user),
            replayed: true,
          };
        }

        // ==================== Validate Order Status ====================

        if (
          ![
            "Out For Delivery",
            "Delivered",
            "Partially Returned",
          ].includes(order.status)
        ) {
          this.fail(
            "Order must be dispatched before returning",
            409
          );
        }

        // ==================== Validate And Classify Return Items ====================

        const returnedItems = [];
        let returnedAmount = 0;

        for (const requested of body.items) {
          const item = order.items.id(
            requested.orderItem
          );

          if (!item) {
            this.fail("Order item not found", 404);
          }

          // ==================== Calculate Returnable Quantity ====================

          const availableToReturn =
            item.dispatchedQuantity -
            item.returnedQuantity;

          if (
            !Number.isSafeInteger(requested.quantity) ||
            requested.quantity < 1 ||
            requested.quantity > availableToReturn
          ) {
            this.fail(
              "Return quantity exceeds remaining dispatched quantity",
              409
            );
          }

          // ==================== Calculate Pending Quantity ====================

          const pendingQuantity =
            item.dispatchedQuantity -
            item.returnedQuantity -
            item.deliveredQuantity;

          if (pendingQuantity < 0) {
            this.fail(
              "Inconsistent order item quantities",
              409
            );
          }

          // ==================== Classify Return ====================

          const preDeliveryQuantity = Math.min(
            requested.quantity,
            pendingQuantity
          );

          const postDeliveryQuantity =
            requested.quantity -
            preDeliveryQuantity;

          if (
            postDeliveryQuantity >
            item.deliveredQuantity
          ) {
            this.fail(
              "Invalid post-delivery return quantity",
              409
            );
          }

          // ==================== Calculate Return Amount ====================

          const totalPrice = this.multiplyAmount(
            requested.quantity,
            item.unitPrice,
            "return item amount"
          );

          returnedAmount = this.sumAmount(
            returnedAmount,
            totalPrice,
            "returned amount"
          );

          returnedItems.push({
            orderItem: item._id,
            variant: item.variant,
            quantity: requested.quantity,
            unitPrice: item.unitPrice,
            totalPrice,
            preDeliveryQuantity,
            postDeliveryQuantity,
            restockedQuantity: body.reason === "DAMAGED" ? 0 : requested.quantity,
            quarantinedQuantity: body.reason === "DAMAGED" ? requested.quantity : 0,
          });
        }

        // ==================== Calculate Return Classification ====================

        const totalDispatched = order.items.reduce(
          (sum, item) =>
            sum + BigInt(item.dispatchedQuantity),
          0n
        );

        const previousReturns = order.items.reduce(
          (sum, item) =>
            sum + BigInt(item.returnedQuantity),
          0n
        );

        const newReturns = returnedItems.reduce(
          (sum, item) =>
            sum + BigInt(item.quantity),
          0n
        );

        const cumulativeReturns =
          previousReturns + newReturns;

        // ==================== Create Return Document ====================

        const orderReturn = new OrderReturn({
          order: order._id,
          items: returnedItems,
          type:
            cumulativeReturns === totalDispatched
              ? "FULL"
              : "PARTIAL",
          reason: body.reason,
          note: body.note,
          returnedAmount,
          processedBy: user._id,
          idempotencyKey: key,
          idempotencyHash: hash,
        });

        await orderReturn.save({ session });

        // ==================== Restore Inventory ====================

        for (const returned of returnedItems) {
          const item = order.items.id(
            returned.orderItem
          );

          const receiveReturn = body.reason === "DAMAGED" ? inventoryHelper.quarantineStock : inventoryHelper.returnStock;
          await receiveReturn({
            variantId: item.variant,
            quantity: returned.quantity,
            order: order._id,
            orderItem: item._id,
            performedBy: user._id,
            reason: body.reason,
            note: body.note,
            session,
          });

          // ==================== Update Returned Quantity ====================

          item.returnedQuantity += returned.quantity;

          // ==================== Update Net Delivered Quantity ====================

          item.deliveredQuantity -=
            returned.postDeliveryQuantity;

          // ==================== Validate Updated Quantities ====================

          if (
            item.deliveredQuantity < 0 ||
            item.deliveredQuantity +
              item.returnedQuantity >
              item.dispatchedQuantity
          ) {
            this.fail(
              "Inconsistent return quantities",
              409
            );
          }
        }

        // ==================== Recalculate Financial Amounts ====================

        this.calculateFollowUpAmounts(order);

        const fromStatus = order.status;

        // ==================== Update Order Status ====================

        order.status =
          cumulativeReturns === totalDispatched
            ? "Returned"
            : "Partially Returned";

        // ==================== Update Follow-up Completion ====================

        order.followUpCompleted = order.items.every(
          (item) =>
            item.deliveredQuantity +
              item.returnedQuantity ===
            item.dispatchedQuantity
        );

        if (order.followUpCompleted) {
          order.completedBy = user._id;
          order.completedAt = new Date();
        } else {
          order.completedBy = null;
          order.completedAt = null;
        }

        order.updatedBy = user._id;

        await order.save({ session });

        // ==================== Save Return History ====================

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
          order: this.serialize(order, user),
          orderReturn: this.serialize(
            orderReturn,
            user
          ),
          replayed: false,
        };
      });
    } catch (error) {
      // ==================== Handle Duplicate Idempotency Key ====================

      if (error.code === 11000) {
        const replay = await getExistingReturn();

        if (replay) return replay;
      }

      throw error;
    }
  };
}

// ==================== Export Helper ====================

module.exports = new OrderHelper();
