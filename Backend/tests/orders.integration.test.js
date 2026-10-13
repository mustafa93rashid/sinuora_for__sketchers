const { test } = require("node:test");
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const { mkdtempSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const { once } = require("node:events");
const net = require("node:net");
const mongoose = require("mongoose");
const { MongoClient } = require("mongodb");
const Order = require("../src/models/order.model");
const Return = require("../src/models/orderReturn.model");
const History = require("../src/models/orderStatusHistory.model");
const Product = require("../src/models/product.model");
const Variant = require("../src/models/productVariant.model");
const Movement = require("../src/models/inventoryTransaction.model");
const User = require("../src/models/user.model");
const helper = require("../src/helpers/order.helper");
const inventory = require("../src/helpers/inventory.helper");

// ==================== Isolated Replica Set Integration Tests ====================

test("Orders on an isolated MongoDB replica set", { skip: !process.env.MONGOD_BINARY, timeout: 120000 }, async (t) => {
  const portServer = net.createServer().listen(0, "127.0.0.1");
  await once(portServer, "listening");
  const port = portServer.address().port;
  await new Promise((resolve) => portServer.close(resolve));
  const dataPath = mkdtempSync(join(tmpdir(), "sfs-orders-tests-"));
  const processHandle = spawn(process.env.MONGOD_BINARY, ["--dbpath", dataPath, "--port", String(port), "--bind_ip", "127.0.0.1", "--replSet", "sfsOrdersTest", "--logpath", join(dataPath, "mongo.log")], { windowsHide: true, stdio: "ignore" });
  let server;
  t.after(async () => {
    if (server) await new Promise((resolve) => server.close(resolve));
    await mongoose.disconnect();
    if (processHandle.exitCode === null) {
      const exited = once(processHandle, "exit");
      processHandle.kill();
      await exited;
    }
  });
  const bootstrap = new MongoClient(`mongodb://127.0.0.1:${port}/?directConnection=true`, { serverSelectionTimeoutMS: 15000 });
  await bootstrap.connect();
  await bootstrap.db("admin").command({ replSetInitiate: { _id: "sfsOrdersTest", members: [{ _id: 0, host: `127.0.0.1:${port}` }] } });
  await bootstrap.close();
  await mongoose.connect(`mongodb://127.0.0.1:${port}/sfs_orders_test?replicaSet=sfsOrdersTest`, { serverSelectionTimeoutMS: 20000 });
  for (const model of [Order, Return, History, Product, Variant, Movement, User]) await model.init();
  const seller = { _id: new mongoose.Types.ObjectId(), role: "saler" };
  const admin = { _id: new mongoose.Types.ObjectId(), role: "superadmin" };
  const other = { _id: new mongoose.Types.ObjectId(), role: "saler" };
  const manager = { _id: new mongoose.Types.ObjectId(), role: "manager" };
  const followUp = { _id: new mongoose.Types.ObjectId(), role: "follow-up" };
  const product = await Product.create({ name: "Test shoe", modelCode: "TEST", createdBy: admin._id });
  let sequence = 0;
  const variant = (stock) => Variant.create({ product: product._id, color: `color-${++sequence}`, size: 38, stockQuantity: stock });
  const body = (...variants) => ({ customer: { name: "Test", instagramUsername: "test", address: "Baghdad" }, items: variants.map((v) => ({ variant: String(v._id), quantity: 1, unitPrice: 100 })) });
  const create = (value, key, user = seller) => helper.createOrder({ user, body: value, key });

  await t.test("Create snapshots, reservations and history atomically; replay returns same order", async () => {
    const v = await variant(3);
    const result = await create(body(v), "create-0001");
    assert.equal(result.order.status, "New");
    assert.equal(result.order.subtotal, 100);
    assert.equal(result.order.items[0].productSnapshot.color, v.color);
    assert.equal(result.order.idempotencyKey, undefined);
    assert.equal((await Variant.findById(v._id)).reservedQuantity, 1);
    assert.equal((await Variant.findById(v._id)).stockQuantity, 3);
    assert.equal(await Movement.countDocuments({ order: result.order._id }), 1);
    assert.equal(await History.countDocuments({ order: result.order._id, toStatus: "New" }), 1);
    const replay = await create(body(v), "create-0001");
    assert.equal(replay.replayed, true);
    assert.equal(String(replay.order._id), String(result.order._id));
    const changed = body(v); changed.items[0].quantity = 2;
    await assert.rejects(create(changed, "create-0001"), { statusCode: 409 });
    assert.equal((await Variant.findById(v._id)).reservedQuantity, 1);
  });

  await t.test("Two sales of the last unit allow exactly one order", async () => {
    const v = await variant(1);
    const results = await Promise.allSettled([create(body(v), "last-unit-a"), create(body(v), "last-unit-b", other)]);
    assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
    assert.equal((await Variant.findById(v._id)).reservedQuantity, 1);
    assert.equal(await Movement.countDocuments({ variant: v._id }), 1);
  });

  await t.test("Concurrent identical requests reserve once", async () => {
    const v = await variant(4);
    const results = await Promise.all([create(body(v), "same-key-001"), create(body(v), "same-key-001")]);
    assert.equal(String(results[0].order._id), String(results[1].order._id));
    assert.equal((await Variant.findById(v._id)).reservedQuantity, 1);
    assert.equal(await Movement.countDocuments({ variant: v._id }), 1);
  });

  await t.test("Failure on second item rolls back the first reservation and order", async () => {
    const first = await variant(2);
    const second = await variant(0);
    await assert.rejects(create(body(first, second), "rollback-001"), { statusCode: 409 });
    assert.equal((await Variant.findById(first._id)).reservedQuantity, 0);
    assert.equal(await Order.countDocuments({ idempotencyKey: "rollback-001" }), 0);
    assert.equal(await Movement.countDocuments({ variant: first._id }), 0);
  });

  await t.test("History write failure rolls back order and inventory", async () => {
    const v = await variant(2);
    const original = History.prototype.save;
    History.prototype.save = async () => { throw new Error("Injected history failure"); };
    try { await assert.rejects(create(body(v), "history-fail"), /Injected history failure/); }
    finally { History.prototype.save = original; }
    assert.equal((await Variant.findById(v._id)).reservedQuantity, 0);
    assert.equal(await Movement.countDocuments({ variant: v._id }), 0);
    assert.equal(await Order.countDocuments({ idempotencyKey: "history-fail" }), 0);
  });

  await t.test("Standalone inventory write failure rolls back stock", async () => {
    const v = await variant(2);
    const original = inventory.createTransaction;
    inventory.createTransaction = async () => { throw new Error("Injected movement failure"); };
    try { await assert.rejects(inventory.addStock({ variantId: v._id, quantity: 3, performedBy: admin._id }), /Injected movement failure/); }
    finally { inventory.createTransaction = original; }
    assert.equal((await Variant.findById(v._id)).stockQuantity, 2);
  });

  await t.test("Concurrent stock additions are retained and return a usable document", async () => {
    const v = await variant(2);
    await Promise.all([
      inventory.addStock({ variantId: v._id, quantity: 2, performedBy: admin._id }),
      inventory.addStock({ variantId: v._id, quantity: 3, performedBy: admin._id }),
    ]);
    assert.equal((await Variant.findById(v._id)).stockQuantity, 7);
    const result = await inventory.addStock({ variantId: v._id, quantity: 1, performedBy: admin._id });
    await result.populate({ path: "product", select: "name" });
    assert.equal(result.product.name, "Test shoe");
  });

  await t.test("Concurrent cancellation releases once and retains history", async () => {
    const v = await variant(2);
    const result = await create(body(v), "cancel-0001");
    const cancel = () => helper.cancelOrder({ user: admin, id: String(result.order._id), body: { reason: "Customer cancelled" } });
    await Promise.all([cancel(), cancel()]);
    assert.equal((await Variant.findById(v._id)).reservedQuantity, 0);
    assert.equal((await Variant.findById(v._id)).stockQuantity, 2);
    assert.equal(await Movement.countDocuments({ variant: v._id, type: "RELEASE_RESERVE" }), 1);
    assert.equal(await History.countDocuments({ order: result.order._id }), 2);
    const replay = await create(body(v), "cancel-0001");
    assert.equal(replay.order.status, "Cancelled");
    assert.equal((await Variant.findById(v._id)).reservedQuantity, 0);
  });

  await t.test("Adjustment cannot reduce physical stock below a concurrent reservation", async () => {
    const v = await variant(1);
    await Promise.allSettled([create(body(v), "adjust-race"), inventory.adjustStock({ variantId: v._id, newQuantity: 0, performedBy: admin._id })]);
    const current = await Variant.findById(v._id);
    assert.ok(current.stockQuantity >= current.reservedQuantity);
  });

  await t.test("Inactive products and invalid quantities do not change inventory", async () => {
    const v = await variant(3);
    await Product.updateOne({ _id: product._id }, { isActive: false });
    try { await assert.rejects(create(body(v), "inactive-001"), { statusCode: 404 }); }
    finally { await Product.updateOne({ _id: product._id }, { isActive: true }); }
    await assert.rejects(inventory.reserveStock({ variantId: v._id, quantity: -1, performedBy: seller._id }), { statusCode: 400 });
    assert.equal((await Variant.findById(v._id)).reservedQuantity, 0);
  });

  // ==================== Lifecycle And Partial Returns ====================

  const dispatched = async (quantity = 3, user = seller) => {
    const v = await variant(quantity);
    const data = body(v); data.items[0].quantity = quantity;
    const created = await create(data, "lifecycle-" + (++sequence), user);
    const id = String(created.order._id);
    await helper.startPreparing({ user: manager, id });
    await helper.markPrepared({ user: manager, id });
    const result = await helper.dispatchOrder({ user: manager, id });
    return { v, id, item: String(result.order.items[0]._id) };
  };
  const returning = (order, quantity, key, user = seller) => helper.returnOrderItems({ user, id: order.id, key, body: { items: [{ orderItem: order.item, quantity }], reason: "REFUSED" } });

  await t.test("Repeated partial returns use cumulative quantities without delivering the remainder", async () => {
    const o = await dispatched(3, manager);
    const first = await returning(o, 1, "partial-001", followUp);
    assert.equal(first.order.status, "Partially Returned");
    assert.equal(first.order.items[0].deliveredQuantity, 0);
    assert.equal(first.order.followUpCompleted, false);
    await returning(o, 1, "partial-002", manager);
    const final = await returning(o, 1, "partial-003", admin);
    assert.equal(final.order.status, "Returned");
    assert.equal(final.orderReturn.type, "FULL");
    assert.equal(final.order.returnedAmount, 300);
    assert.equal(final.order.followUpCompleted, true);
    assert.equal((await Variant.findById(o.v._id)).stockQuantity, 3);
    assert.equal(await Return.countDocuments({ order: o.id }), 3);
    assert.equal(await Movement.countDocuments({ order: o.id, type: "RETURN" }), 3);
    const replay = await returning(o, 1, "partial-001", manager);
    assert.equal(replay.replayed, true);
    assert.equal(replay.orderReturn.idempotencyHash, undefined);
    await assert.rejects(returning(o, 2, "partial-001", manager), { statusCode: 409 });
    await assert.rejects(returning(o, 1, "partial-004", manager), { statusCode: 409 });
  });

  await t.test("Seller can deliver and return own order, including after delivery", async () => {
    const o = await dispatched();
    await assert.rejects(returning(o, 1, "other-user-1", other), { statusCode: 404 });
    await assert.rejects(helper.deliverOrder({ user: other, id: o.id }), { statusCode: 404 });
    await returning(o, 1, "before-delivery");
    const delivered = await helper.deliverOrder({ user: seller, id: o.id });
    assert.equal(delivered.order.status, "Partially Returned");
    assert.equal(delivered.order.items[0].deliveredQuantity, 2);
    assert.equal(delivered.order.deliveredAmount, 200);
    assert.equal(delivered.order.returnedAmount, 100);
    assert.equal(delivered.order.followUpCompleted, true);
    await returning(o, 1, "after-delivery");
    const last = await returning(o, 1, "after-delivery-2");
    assert.equal(last.order.deliveredAmount, 0);
    assert.equal(last.order.status, "Returned");
  });

  await t.test("Concurrent identical returns restore inventory exactly once", async () => {
    const o = await dispatched();
    const results = await Promise.all([returning(o, 1, "concurrent-key"), returning(o, 1, "concurrent-key")]);
    assert.equal(results.filter((r) => r.replayed).length, 1);
    assert.equal((await Variant.findById(o.v._id)).stockQuantity, 1);
    assert.equal(await Return.countDocuments({ order: o.id }), 1);
    assert.equal(await Movement.countDocuments({ order: o.id, type: "RETURN" }), 1);
  });

  await t.test("Different concurrent returns cannot exceed dispatched quantity", async () => {
    const o = await dispatched(1);
    const results = await Promise.allSettled([returning(o, 1, "race-return-a"), returning(o, 1, "race-return-b")]);
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
    assert.equal((await Variant.findById(o.v._id)).stockQuantity, 1);
    assert.equal((await Order.findById(o.id)).items[0].returnedQuantity, 1);
  });

  await t.test("Return rollback includes return document, quantities, stock and history", async () => {
    const o = await dispatched();
    const original = History.prototype.save;
    History.prototype.save = async () => { throw new Error("Injected return failure"); };
    try { await assert.rejects(returning(o, 1, "return-rollback"), /Injected return failure/); }
    finally { History.prototype.save = original; }
    assert.equal((await Variant.findById(o.v._id)).stockQuantity, 0);
    assert.equal((await Order.findById(o.id)).items[0].returnedQuantity, 0);
    assert.equal(await Return.countDocuments({ order: o.id }), 0);
    await returning(o, 1, "return-rollback");
  });

  await t.test("Update preserves item identity, links new movements and rolls back insufficient stock", async () => {
    const a = await variant(3), b = await variant(2), empty = await variant(0);
    const created = await create(body(a), "update-order-1");
    const id = String(created.order._id);
    const oldId = String(created.order.items[0]._id);
    const updated = body(a, b); updated.items[0].quantity = 2;
    const result = await helper.updateOrder({ user: seller, id, body: { items: updated.items } });
    assert.equal(String(result.order.items.find((item) => String(item.variant) === String(a._id))._id), oldId);
    const added = result.order.items.find((item) => String(item.variant) === String(b._id));
    assert.equal(await Movement.countDocuments({ order: id, orderItem: added._id }), 1);
    await assert.rejects(helper.updateOrder({ user: seller, id, body: { items: body(a, empty).items } }), { statusCode: 409 });
    assert.equal((await Variant.findById(a._id)).reservedQuantity, 2);
    await helper.updateOrder({ user: manager, id, body: { items: body(b).items } });
    assert.equal((await Variant.findById(a._id)).reservedQuantity, 0);
    await assert.rejects(helper.updateOrder({ user: followUp, id, body: { notes: "invalid" } }), { statusCode: 403 });
    await helper.cancelOrder({ user: manager, id, body: { reason: "Cancelled" } });
    assert.equal((await Variant.findById(b._id)).reservedQuantity, 0);
  });

  // ==================== Authenticated HTTP Tests ====================

  await t.test("Concurrent update and cancellation keep stock consistent", async () => {
    const v = await variant(5);
    const created = await create(body(v), "update-cancel-race");
    const id = String(created.order._id);
    const data = body(v); data.items[0].quantity = 3;
    await Promise.allSettled([
      helper.updateOrder({ user: seller, id, body: { items: data.items } }),
      helper.cancelOrder({ user: seller, id, body: { reason: "Cancel" } }),
    ]);
    assert.equal((await Order.findById(id)).status, "Cancelled");
    assert.equal((await Variant.findById(v._id)).reservedQuantity, 0);
    assert.equal((await Variant.findById(v._id)).stockQuantity, 5);
  });

  await t.test("Multiple variants return to their own stock and concurrent delivery remains consistent", async () => {
    const a = await variant(2), b = await variant(3);
    const created = await create(body(a, b), "multi-variant-return");
    const id = String(created.order._id);
    await helper.startPreparing({ user: manager, id });
    await helper.markPrepared({ user: manager, id });
    await helper.dispatchOrder({ user: manager, id });
    const item = String(created.order.items.find((i) => String(i.variant) === String(a._id))._id);
    await Promise.all([
      returning({ id, item }, 1, "multi-return-1"),
      helper.deliverOrder({ user: followUp, id }),
    ]);
    const current = await Order.findById(id);
    assert.equal(current.status, "Partially Returned");
    assert.equal(current.returnedAmount, 100);
    assert.equal(current.deliveredAmount, 100);
    assert.equal(current.followUpCompleted, true);
    assert.equal((await Variant.findById(a._id)).stockQuantity, 2);
    assert.equal((await Variant.findById(b._id)).stockQuantity, 2);
  });

  process.env.JWT_SECRET_KEY = "isolated-test-secret-not-for-deployment";
  process.env.DOTENV_CONFIG_QUIET = "true";
  const jwt = require("jsonwebtoken");
  const express = require("express");
  const app = express();
  app.use(express.json());
  app.use(require("../src/middlewares/xss"));
  app.use("/api/v1/orders", require("../src/routers/order.routes"));
  app.use(require("../src/middlewares/errorHandler"));
  for (const user of [seller, admin, other, manager, followUp]) {
    await User.collection.insertOne({ ...user, fullName: user.role, email: `${user._id}@example.test`, isActive: true, isAccountActivated: true });
  }
  server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const request = async (user, path, method = "GET", value, key = "http-key-001") => {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/v1/orders${path}`, {
      method,
      headers: { "Content-Type": "application/json", "Idempotency-Key": key, ...(user ? { Authorization: `Bearer ${jwt.sign({ id: String(user._id) }, process.env.JWT_SECRET_KEY)}` } : {}) },
      ...(value ? { body: JSON.stringify(value) } : {}),
    });
    return { status: response.status, data: await response.json() };
  };
  await t.test("HTTP authorization, ownership, validation and cancellation", async () => {
    const v = await variant(4);
    assert.equal((await request(null, "")).status, 401);
    assert.equal((await request(manager, "", "POST", body(v))).status, 201);
    assert.equal((await request(followUp, "", "POST", body(v))).status, 403);
    const created = await request(seller, "", "POST", body(v));
    assert.equal(created.status, 201);
    const id = created.data.data.order._id;
    assert.equal((await request(other, `/${id}`)).status, 404);
    assert.equal((await request(followUp, `/${id}`)).status, 404);
    assert.equal((await request(manager, `/${id}`)).status, 200);
    const listing = await request(other, "");
    assert.ok(listing.data.data.orders.every((order) => order.createdBy === String(other._id)));
    assert.equal((await request(other, `/${id}/cancel`, "PATCH", { reason: "Cancel" })).status, 404);
    assert.equal((await request(seller, `/${id}/cancel`, "PATCH", { reason: "Cancel" })).status, 200);
    assert.equal((await request(admin, "/?limit=101")).status, 400);
    assert.equal((await request(admin, "/invalid-id")).status, 400);
    assert.equal((await request(seller, "", "POST", { ...body(v), status: "Delivered" }, "fee-invalid")).status, 400);
  });

  await t.test("HTTP lifecycle permissions and repeated returns", async () => {
    const v = await variant(3);
    const data = body(v); data.items[0].quantity = 3;
    const created = await request(seller, "", "POST", data, "http-lifecycle");
    const id = created.data.data.order._id;
    const item = created.data.data.order.items[0]._id;
    assert.equal((await request(seller, `/${id}`, "PATCH", { notes: "Changed" })).status, 200);
    assert.equal((await request(seller, `/${id}/prepare`, "PATCH", {})).status, 403);
    for (const action of ["prepare", "prepared", "dispatch"]) assert.equal((await request(manager, `/${id}/${action}`, "PATCH", {})).status, 200);
    assert.equal((await request(followUp, `/${id}/cancel`, "PATCH", { reason: "No" })).status, 403);
    const value = { items: [{ orderItem: item, quantity: 1 }], reason: "REFUSED" };
    assert.equal((await request(other, `/${id}/returns`, "POST", value, "other-return")).status, 404);
    assert.equal((await request(seller, `/${id}/returns`, "POST", value, "http-return-1")).status, 200);
    assert.equal((await request(followUp, `/${id}/deliver`, "PATCH", {})).status, 200);
    assert.equal((await request(manager, `/${id}/returns`, "POST", value, "http-return-2")).status, 200);
    const final = await request(seller, `/${id}/returns`, "POST", value, "http-return-3");
    assert.equal(final.data.data.order.status, "Returned");
    assert.equal((await request(seller, `/${id}/returns`, "POST", value, "http-return-1")).data.replayed, true);
    assert.equal((await request(seller, `/${id}/returns`, "POST", value, "")).status, 400);
    assert.equal((await request(other, `/${id}/history`)).status, 404);
    assert.equal((await request(followUp, `/${id}/history`)).status, 200);
  });
});

