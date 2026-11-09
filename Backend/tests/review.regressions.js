const assert = require("node:assert/strict");
const { once } = require("node:events");
const { Writable } = require("node:stream");

module.exports = async (t, { server, admin, manager, seller, followUp, create, body, variant, dispatched, returning }) => {
  const Product = require("../src/models/product.model");
  const Variant = require("../src/models/productVariant.model");
  const Order = require("../src/models/order.model");
  const Movement = require("../src/models/inventoryTransaction.model");
  const User = require("../src/models/user.model");
  const Job = require("../src/models/maintenanceJob.model");
  const catalog = require("../src/helpers/catalog.helper");
  const inventory = require("../src/helpers/inventory.helper");
  const jwt = require("../src/utils/jwtService");
  const passwords = require("../src/utils/passwordService");
  const codes = require("../src/utils/verificationCodeService");
  const { hashToken } = require("../src/helpers/session.helper");
  const { changeUser } = require("../src/helpers/userAdmin.helper");
  const email = require("../src/services/email.service");
  const cloudinary = require("../src/config/cloudinary");
  const media = require("../src/services/cloudinary.service");
  const maintenance = require("../src/services/maintenance.service");
  await Job.init();
  let sequence = 0;
  const token = user => jwt.generateAccessToken({ id: String(user._id), role: user.role, ver: user.tokenVersion ?? 0 });
  const api = async (user, path, method = "GET", data, extraHeaders = {}) => {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/v1${path}`, {
      method, headers: { "Content-Type": "application/json", ...(user && { Authorization: `Bearer ${typeof user === "string" ? user : token(user)}` }), ...extraHeaders },
      ...(data !== undefined && { body: JSON.stringify(data) }),
    });
    return { status: response.status, data: await response.json(), cookies: response.headers.getSetCookie().map(cookie => cookie.split(";")[0]).join("; ") };
  };
  const newProduct = () => Product.create({ name: "Regression shoe", modelCode: `REVIEW-${++sequence}`, costPrice: 70, defaultSalePrice: 100, createdBy: admin._id });
  const makeUser = async (role = "saler") => User.create({
    fullName: "Review User", email: `review-${++sequence}@example.test`, role,
    password: await passwords.hash("Abcd123!<b>X</b>"), isActive: true, isAccountActivated: true,
  });

  await t.test("Product costs and historical order costs follow role permissions", async () => {
    const p = await newProduct();
    const v = await Variant.create({ product: p._id, color: "Black", size: 38, stockQuantity: 2 });
    const o = await create(body(v), "regression-costs");
    for (const user of [seller, followUp]) {
      assert.equal((await api(user, `/products/${p._id}`)).data.data.product.costPrice, undefined);
      const list = await api(user, `/products?search=${p.modelCode}`);
      assert.equal(list.data.data.products[0].costPrice, undefined);
    }
    assert.equal((await api(manager, `/products/${p._id}`)).data.data.product.costPrice, 70);
    assert.equal((await api(manager, `/orders/${o.order._id}`)).data.data.order.items[0].unitCost, 70);
    assert.equal((await api(seller, `/orders/${o.order._id}`)).data.data.order.items[0].unitCost, undefined);
  });

  await t.test("Product price validation and archive endpoint cannot be bypassed", async () => {
    const p = await newProduct();
    const v = await Variant.create({ product: p._id, color: "Blue", size: 38, stockQuantity: 1 });
    await create(body(v), "archive-bypass");
    assert.equal((await api(manager, `/products/${p._id}`, "PATCH", { isActive: false })).status, 400);
    assert.equal((await api(manager, `/products/${p._id}/archive`, "PATCH", {})).status, 409);
    assert.equal((await api(manager, `/products/${p._id}`, "PATCH", { costPrice: 10.5 })).status, 400);
    assert.equal((await Product.findById(p._id)).isActive, true);
    const invalid = new Product({ name: "Fraction", modelCode: "FRACTION", costPrice: 0.1, createdBy: admin._id });
    await assert.rejects(invalid.validate(), /safe integer/);
  });

  await t.test("Express 5 uses validated numeric and boolean query parameters", async () => {
    const p = await newProduct();
    const empty = await Variant.create({ product: p._id, color: "Empty", size: 38 });
    await Variant.create({ product: p._id, color: "Full", size: 38, stockQuantity: 20 });
    const result = await api(manager, `/inventory?product=${p._id}&lowStock=0&limit=2&isActive=true`);
    assert.equal(result.status, 200);
    assert.deepEqual(result.data.data.variants.map(v => v._id), [String(empty._id)]);
    assert.equal(typeof result.data.pagination.limit, "number");
    assert.equal((await api(manager, "/inventory?lowStock=invalid")).status, 400);
    assert.equal((await api(manager, "/users?page=invalid")).status, 400);
    assert.equal((await api(manager, "/users?search=%5B")).status, 200);
  });

  await t.test("Inventory ledger is restricted and manual additions replay exactly once", async () => {
    const v = await variant(0);
    for (const user of [seller, followUp]) {
      assert.equal((await api(user, "/inventory/transactions")).status, 403);
      assert.equal((await api(user, `/inventory/variant/${v._id}/transactions`)).status, 403);
    }
    const path = `/inventory/variant/${v._id}/add`;
    const data = { quantity: 3, reason: "Receiving" };
    assert.equal((await api(manager, path, "POST", data)).status, 400);
    const headers = { "Idempotency-Key": "manual-stock-001" };
    const results = await Promise.all([api(manager, path, "POST", data, headers), api(manager, path, "POST", data, headers)]);
    assert.ok(results.every(r => r.status === 200), JSON.stringify(results));
    assert.equal((await Variant.findById(v._id)).stockQuantity, 3);
    assert.equal(await Movement.countDocuments({ variant: v._id }), 1);
    assert.equal((await api(manager, path, "POST", { ...data, quantity: 4 }, headers)).status, 409);
    const ledger = await api(manager, `/inventory/variant/${v._id}/transactions`);
    assert.equal(ledger.status, 200);
    assert.equal(ledger.data.data.transactions[0].idempotencyHash, undefined);
  });

  await t.test("Concurrent archiving and reservation never leave archived stock reserved", async () => {
    for (const parent of [true, false]) {
      for (let i = 0; i < 5; i++) {
        const p = await newProduct();
        const v = await Variant.create({ product: p._id, color: "Race", size: 38, stockQuantity: 1 });
        await Promise.allSettled([
          create(body(v), `archive-race-${sequence}`),
          parent ? catalog.setProductActive(p._id, false, admin._id) : catalog.setVariantActive(v._id, false),
        ]);
        const current = await Variant.findById(v._id);
        const product = await Product.findById(p._id);
        assert.ok(current.reservedQuantity === 0 || (current.isActive && product.isActive));
      }
    }
  });

  await t.test("Archiving a product cascades isActive:false to its variants; restoring the product does not cascade back on", async () => {
    const p = await newProduct();
    const v1 = await Variant.create({ product: p._id, color: "Cascade1", size: 38 });
    const v2 = await Variant.create({ product: p._id, color: "Cascade2", size: 38 });
    await catalog.setVariantActive(v2._id, false);
    await catalog.setProductActive(p._id, false, admin._id);
    assert.equal((await Variant.findById(v1._id)).isActive, false);
    assert.equal((await Variant.findById(v2._id)).isActive, false);
    await catalog.setProductActive(p._id, true, admin._id);
    assert.equal((await Variant.findById(v1._id)).isActive, false, "restoring the product must not reactivate variants");
    assert.equal((await Variant.findById(v2._id)).isActive, false);
  });

  await t.test("Variant identity is immutable after use, including legacy history and races", async () => {
    const p = await newProduct();
    const unused = await catalog.createVariant({ product: p._id, color: "Original", size: 38 });
    assert.equal((await catalog.updateVariant(unused._id, { color: "Renamed" })).color, "Renamed");
    await inventory.addStock({ variantId: unused._id, quantity: 1, performedBy: admin._id });
    await inventory.adjustStock({ variantId: unused._id, newQuantity: 0, performedBy: admin._id });
    await Variant.updateOne({ _id: unused._id }, { $unset: { identityLocked: 1 } });
    await assert.rejects(catalog.updateVariant(unused._id, { size: 39 }), { statusCode: 409 });
    const race = await catalog.createVariant({ product: p._id, color: "Concurrent", size: 38 });
    await Promise.allSettled([
      catalog.updateVariant(race._id, { size: 39 }),
      inventory.addStock({ variantId: race._id, quantity: 1, performedBy: admin._id }),
    ]);
    assert.equal((await Variant.findById(race._id)).stockQuantity, 1);
    await assert.rejects(catalog.updateVariant(race._id, { color: "Later" }), { statusCode: 409 });
  });

  await t.test("Damaged returns are quarantined and retries cannot restock or duplicate them", async () => {
    const o = await dispatched(2);
    const result = await api(seller, `/orders/${o.id}/returns`, "POST", {
      items: [{ orderItem: o.item, quantity: 1 }], reason: "DAMAGED",
    }, { "Idempotency-Key": "damaged-return-001" });
    assert.equal(result.status, 200, JSON.stringify(result));
    assert.equal(result.data.data.orderReturn.items[0].restockedQuantity, 0);
    assert.equal(result.data.data.orderReturn.items[0].quarantinedQuantity, 1);
    await api(seller, `/orders/${o.id}/returns`, "POST", { items: [{ orderItem: o.item, quantity: 1 }], reason: "DAMAGED" }, { "Idempotency-Key": "damaged-return-001" });
    const v = await Variant.findById(o.v._id);
    assert.equal(v.stockQuantity, 0);
    assert.equal(v.quarantinedQuantity, 1);
    assert.equal(await Movement.countDocuments({ variant: v._id, type: "QUARANTINE_RETURN" }), 1);
    await assert.rejects(create(body(v), "cannot-sell-damaged"), { statusCode: 409 });
  });

  await t.test("Adjustment can correct stock on an archived variant without restoring it first", async () => {
    const p = await newProduct();
    const v = await Variant.create({ product: p._id, color: "Correctable", size: 38, stockQuantity: 5 });
    await catalog.setVariantActive(v._id, false);
    await inventory.adjustStock({ variantId: v._id, newQuantity: 0, performedBy: admin._id });
    const updated = await Variant.findById(v._id);
    assert.equal(updated.stockQuantity, 0);
    assert.equal(updated.isActive, false);
  });

  await t.test("Adjustment also works after the whole product is archived (cascading the variant inactive)", async () => {
    const p = await newProduct();
    const v = await Variant.create({ product: p._id, color: "CorrectableCascade", size: 38, stockQuantity: 5 });
    await catalog.setProductActive(p._id, false, admin._id);
    await inventory.adjustStock({ variantId: v._id, newQuantity: 0, performedBy: admin._id });
    const updated = await Variant.findById(v._id);
    assert.equal(updated.stockQuantity, 0);
    assert.equal(updated.isActive, false);
  });

  await t.test("A resellable return intentionally still restocks an archived variant, so staff can process a customer return after discontinuation", async () => {
    const o = await dispatched(2);
    await catalog.setVariantActive(o.v._id, false);
    const result = await returning(o, 1, "archived-return-001");
    assert.equal(result.order.status, "Partially Returned");
    const v = await Variant.findById(o.v._id);
    assert.equal(v.stockQuantity, 1);
    assert.equal(v.isActive, false, "the variant stays archived; only its stock figure is corrected");
  });

  await t.test("Logout revokes access and refresh tokens while passwords retain their exact bytes", async () => {
    const user = await makeUser();
    const wrong = await api(null, "/auth/login", "POST", { email: user.email, password: "Abcd123!X" });
    assert.equal(wrong.status, 400);
    const login = await api(null, "/auth/login", "POST", { email: user.email, password: "Abcd123!<b>X</b>" });
    assert.equal(login.status, 200, JSON.stringify(login));
    assert.equal((await api(null, "/auth/me", "GET", undefined, { Cookie: login.cookies })).status, 200);
    assert.equal((await api(null, "/auth/logout", "POST", {}, { Cookie: login.cookies })).status, 200);
    assert.equal((await api(null, "/auth/me", "GET", undefined, { Cookie: login.cookies })).status, 401);
    assert.equal((await api(null, "/auth/refresh-token", "POST", {}, { Cookie: login.cookies })).status, 401);
  });

  await t.test("Login takes a comparably expensive password check whether or not the email exists", async () => {
    const user = await makeUser();
    const time = async (payload) => {
      const start = process.hrtime.bigint();
      await api(null, "/auth/login", "POST", payload);
      return Number(process.hrtime.bigint() - start) / 1e6;
    };
    const existingEmailWrongPassword = await time({ email: user.email, password: "wrong-password" });
    const nonExistentEmail = await time({ email: `missing-${++sequence}@example.test`, password: "wrong-password" });
    assert.ok(existingEmailWrongPassword > 20, `expected a real password hash comparison (>20ms), took ${existingEmailWrongPassword}ms`);
    assert.ok(nonExistentEmail > 20, `expected a dummy password hash comparison (>20ms) even for an unknown email, took ${nonExistentEmail}ms`);
  });

  await t.test("An account with anomalous failed-login activity is slowed, never blocked, and a correct password still succeeds", async () => {
    const user = await makeUser();
    const loginAnomaly = require("../src/helpers/loginAnomaly.helper");
    for (let i = 0; i < 12; i++) loginAnomaly.recordFailedLogin(user.email);
    const login = await api(null, "/auth/login", "POST", { email: user.email, password: "Abcd123!<b>X</b>" });
    assert.equal(login.status, 200, JSON.stringify(login));
    loginAnomaly.clearFailedLogins(user.email);
  });

  await t.test("Legacy users without version fields can update a profile and log in", async () => {
    const user = await makeUser();
    await User.collection.updateOne({ _id: user._id }, { $unset: { __v: 1, tokenVersion: 1, deletedAt: 1 } });
    const profile = await api(user, "/users/profile", "PATCH", { fullName: "Updated Legacy User" });
    assert.equal(profile.status, 200, JSON.stringify(profile));
    assert.equal((await User.findById(user._id)).fullName, "Updated Legacy User");
    const login = await api(null, "/auth/login", "POST", { email: user.email, password: "Abcd123!<b>X</b>" });
    assert.equal(login.status, 200, JSON.stringify(login));
  });

  await t.test("Concurrent refresh consumes once and does not revoke the winning session", async () => {
    const user = await makeUser();
    const refresh = jwt.generateRefreshToken({ id: String(user._id), role: user.role, ver: 0 });
    assert.notEqual(refresh, jwt.generateRefreshToken({ id: String(user._id), role: user.role, ver: 0 }));
    await User.updateOne({ _id: user._id }, { $set: { refreshToken: hashToken(refresh) } });
    const calls = await Promise.all([1, 2].map(() => api(null, "/auth/refresh-token", "POST", {}, { Cookie: `refreshToken=${refresh}` })));
    assert.deepEqual(calls.map(r => r.status).sort(), [200, 401]);
    const winner = calls.find(r => r.status === 200);
    assert.equal((await api(null, "/auth/refresh-token", "POST", {}, { Cookie: winner.cookies })).status, 200);
  });

  await t.test("Password reset is single-use and revokes earlier access tokens", async () => {
    const user = await makeUser();
    const oldToken = token(user);
    const reset = codes.generateResetToken();
    await User.updateOne({ _id: user._id }, { $set: { passwordResetToken: codes.hashResetToken(reset), passwordResetExpires: new Date(Date.now() + 60000) } });
    const calls = await Promise.all([1, 2].map(() => api(null, `/auth/reset-password/${reset}`, "POST", { newPassword: "Changed123!", confirmPassword: "Changed123!" })));
    assert.equal(calls.filter(r => r.status === 200).length, 1);
    assert.ok(calls.every(r => [200, 400, 409].includes(r.status)), JSON.stringify(calls));
    assert.equal((await api(oldToken, "/auth/me")).status, 401);
  });

  await t.test("Password change codes are atomically consumed and attempts are bounded", async () => {
    const user = await makeUser();
    await User.updateOne({ _id: user._id }, { $set: { passwordChangeCode: codes.hashVerificationCode("123456"), passwordChangeCodeExpires: new Date(Date.now() + 60000), passwordChangeAttempts: 0 } });
    const value = { verificationCode: "123456", newPassword: "Changed123!", confirmPassword: "Changed123!" };
    const calls = await Promise.all([api(user, "/auth/change-password/verify", "POST", value), api(user, "/auth/change-password/verify", "POST", value)]);
    assert.equal(calls.filter(r => r.status === 200).length, 1);
    assert.equal((await api(user, "/auth/me")).status, 401);
    const exhausted = await makeUser();
    await User.updateOne({ _id: exhausted._id }, { $set: { passwordChangeCode: codes.hashVerificationCode("123456"), passwordChangeCodeExpires: new Date(Date.now() + 60000), passwordChangeAttempts: 5 } });
    assert.equal((await api(exhausted, "/auth/change-password/verify", "POST", value)).status, 400);
  });

  await t.test("Email changes require password reauthentication, notify the old address and revoke sessions", async () => {
    const user = await makeUser();
    const newEmail = `changed-${sequence}@example.test`;
    assert.equal((await api(user, "/users/profile/email-change/request", "POST", { newEmail })).status, 400);
    assert.equal((await api(user, "/users/profile/email-change/request", "POST", { newEmail, currentPassword: "Wrong123!" })).status, 400);
    const original = email.sendEmailChangeVerificationEmail;
    let verificationCode;
    email.sendEmailChangeVerificationEmail = async value => { verificationCode = value.verificationCode; };
    try {
      assert.equal((await api(user, "/users/profile/email-change/request", "POST", { newEmail, currentPassword: "Abcd123!<b>X</b>" })).status, 200);
      const calls = await Promise.all([1, 2].map(() => api(user, "/users/profile/email-change/verify", "POST", { verificationCode })));
      assert.equal(calls.filter(r => r.status === 200).length, 1, JSON.stringify(calls));
      assert.equal((await User.findById(user._id)).email, newEmail);
      assert.equal((await api(user, "/auth/me")).status, 401);
      assert.equal(await Job.countDocuments({ kind: "securityEmail", "payload.to": user.email }), 1);
    } finally { email.sendEmailChangeVerificationEmail = original; }
  });

  await t.test("Self-management is blocked and soft deletion preserves audit references", async () => {
    assert.equal((await api(admin, `/users/${admin._id}/role`, "PATCH", { role: "manager" })).status, 400);
    assert.equal((await api(admin, `/users/${admin._id}/status`, "PATCH", { isActive: false })).status, 400);
    const user = await makeUser();
    const v = await variant(1);
    const o = await create(body(v), "deleted-actor-order", user);
    assert.equal((await api(admin, `/users/${user._id}`, "DELETE")).status, 200);
    const stored = await User.findById(user._id);
    assert.ok(stored.deletedAt);
    assert.equal(stored.isActive, false);
    assert.equal((await Order.findById(o.order._id).populate("createdBy")).createdBy.fullName, "Review User");
    assert.equal((await api(user, "/auth/me")).status, 401);
    const list = await api(manager, `/users?search=${encodeURIComponent(user.email)}`);
    assert.equal(list.data.results, 0);
  });

  await t.test("Concurrent administrator changes retain an active administrator", async () => {
    const a = await makeUser("superadmin");
    const b = await makeUser("superadmin");
    const results = await Promise.allSettled([changeUser(a, b._id, { isActive: false }), changeUser(b, a._id, { isActive: false })]);
    assert.equal(results.filter(r => r.status === "fulfilled").length, 1);
    assert.equal(await User.countDocuments({ _id: { $in: [a._id, b._id] }, isActive: true }), 1);
  });

  await t.test("Activation has one validated POST entrypoint and consumes its token once", async () => {
    const raw = codes.generateResetToken();
    const user = await makeUser();
    await User.updateOne({ _id: user._id }, { $set: { isActive: false, isAccountActivated: false, activationToken: codes.hashResetToken(raw), activationTokenExpires: new Date(Date.now() + 60000) } });
    assert.equal((await api(null, "/users/activate-account/token")).status, 404);
    assert.equal((await api(null, "/users/activate-account", "POST", { token: raw, password: "weak", confirmPassword: "weak" })).status, 400);
    const value = { token: raw, password: "Active123!", confirmPassword: "Active123!" };
    const calls = await Promise.all([1, 2].map(() => api(null, "/users/activate-account", "POST", value)));
    assert.deepEqual(calls.map(r => r.status).sort(), [200, 400]);
  });

  await t.test("Image replacement commits the reference first; failures retain old media and durable cleanup", async () => {
    const originalUpload = cloudinary.uploader.upload_stream;
    const originalDestroy = cloudinary.uploader.destroy;
    const deleted = [];
    cloudinary.uploader.upload_stream = (options, callback) => new Writable({ write(chunk, encoding, done) { done(); }, final(done) { callback(null, { secure_url: `https://example.test/${options.public_id}`, public_id: options.public_id }); done(); } });
    cloudinary.uploader.destroy = async publicId => { deleted.push(publicId); return { result: "ok" }; };
    const p = await newProduct();
    p.images = [{ url: "https://example.test/old", publicId: "review/old" }];
    await p.save();
    const fakeFile = { buffer: Buffer.from("test-image") };
    try {
      const uploaded = await media.uploadImage(fakeFile, "review");
      p.images = [uploaded];
      await media.saveWithImages(p, [uploaded], ["review/old"]);
      assert.equal(deleted.length, 0);
      assert.equal((await Product.findById(p._id)).images[0].publicId, uploaded.publicId);
      const stale = await Product.findById(p._id);
      await Product.updateOne({ _id: p._id }, { $inc: { __v: 1 } });
      const abandoned = await media.uploadImage(fakeFile, "review");
      stale.images = [abandoned];
      await assert.rejects(media.saveWithImages(stale, [abandoned], [uploaded.publicId]), /version/i);
      assert.equal((await Product.findById(p._id)).images[0].publicId, uploaded.publicId);
      assert.equal((await Job.findOne({ publicId: abandoned.publicId })).state, "pending");
      // Ignore security-email jobs here: no network side effects in tests.
      const send = email.sendEmail;
      email.sendEmail = async () => ({});
      try { await maintenance.runMaintenance(); } finally { email.sendEmail = send; }
      assert.ok(deleted.includes("review/old"));
      assert.ok(deleted.includes(abandoned.publicId));
      assert.ok(!deleted.includes(uploaded.publicId));
    } finally { cloudinary.uploader.upload_stream = originalUpload; cloudinary.uploader.destroy = originalDestroy; }
  });

  await t.test("Partial image uploads are queued for cleanup without saving an incomplete product", async () => {
    const original = cloudinary.uploader.upload_stream;
    let calls = 0;
    const ids = [];
    cloudinary.uploader.upload_stream = (options, callback) => new Writable({ write(chunk, encoding, done) { done(); }, final(done) {
      ids.push(options.public_id);
      if (++calls === 2) callback(new Error("Injected upload failure"));
      else callback(null, { secure_url: "https://example.test/image", public_id: options.public_id });
      done();
    } });
    try {
      await assert.rejects(media.uploadImages([{ buffer: Buffer.from("a") }, { buffer: Buffer.from("b") }]), /Injected upload failure/);
      assert.equal(await Job.countDocuments({ publicId: { $in: ids }, state: "pending" }), 2);
    } finally { cloudinary.uploader.upload_stream = original; }
  });

  await t.test("Startup accepts replica sets and rejects a simulated standalone server", async () => {
    const mongoose = require("mongoose");
    const { assertTransactionsAvailable } = require("../src/config/startup");
    await assertTransactionsAvailable();
    const original = mongoose.connection.db.admin;
    mongoose.connection.db.admin = () => ({ command: async () => ({ ok: 1 }) });
    try { await assert.rejects(assertTransactionsAvailable(), /standalone/); }
    finally { mongoose.connection.db.admin = original; }
  });

  await t.test("Socket connections close on logout and reject revoked tokens", async () => {
    const WebSocket = require("ws");
    const user = await makeUser();
    const access = token(user);
    const socket = new WebSocket(`ws://127.0.0.1:${server.address().port}/socket.io/?EIO=4&transport=websocket`);
    try {
      const connected = new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("Socket authentication timeout")), 4000);
        socket.on("message", data => {
          const value = String(data);
          if (value.startsWith("0")) socket.send(`40${JSON.stringify({ token: access })}`);
          if (value.startsWith("40")) { clearTimeout(timeout); resolve(); }
          if (value === "2") socket.send("3");
        });
      });
      await connected;
      const closed = once(socket, "close");
      assert.equal((await api(access, "/auth/logout", "POST", {})).status, 200);
      await closed;
      assert.equal((await api(access, "/auth/me")).status, 401);
    } finally { socket.terminate(); }
  });
};
