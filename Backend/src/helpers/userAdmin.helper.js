const mongoose = require("mongoose");
const User = require("../models/user.model");
const runTransaction = require("./transaction.helper");
const { disconnectUser, sensitiveUnset } = require("./session.helper");
const Guard = mongoose.models.AdminGuard || mongoose.model("AdminGuard", new mongoose.Schema({
  _id: String, revision: { type: Number, default: 0 },
}));
const fail = (message, statusCode = 409) => { throw Object.assign(new Error(message), { statusCode }); };

const changeUser = async (actor, id, changes) => {
  if (String(actor._id) === String(id).toLowerCase()) fail("You cannot change your own status, role or delete your account", 400);
  try { await Guard.updateOne({ _id: "active-superadmins" }, { $setOnInsert: { revision: 0 } }, { upsert: true }); }
  catch (error) { if (error.code !== 11000) throw error; }
  const user = await runTransaction(async session => {
    await Guard.updateOne({ _id: "active-superadmins" }, { $inc: { revision: 1 } }, { session });
    // Recheck the actor after acquiring the shared lock, not only in middleware.
    const currentActor = await User.findOne({ _id: actor._id, role: "superadmin", isActive: true, isAccountActivated: true, deletedAt: null }).session(session);
    if (!currentActor || (currentActor.tokenVersion ?? 0) !== (actor.tokenVersion ?? 0)) fail("Administrator session is no longer valid", 403);
    const target = await User.findOne({ _id: id, deletedAt: null }).session(session);
    if (!target) fail("User not found", 404);
    const removesAdmin = changes.deletedAt || changes.isActive === false || (changes.role && changes.role !== "superadmin");
    if (target.role === "superadmin" && target.isActive && target.isAccountActivated && removesAdmin) {
      const count = await User.countDocuments({ role: "superadmin", isActive: true, isAccountActivated: true, deletedAt: null }).session(session);
      if (count <= 1) fail("The last active Super Admin cannot be removed", 403);
    }
    const updated = await User.findOneAndUpdate({ _id: target._id }, {
      $set: changes, $inc: { tokenVersion: 1, __v: 1 },
      $unset: { ...sensitiveUnset, ...((changes.deletedAt || changes.isActive === false) && { activationToken: 1, activationTokenExpires: 1 }) },
    }, { session, returnDocument: "after", runValidators: true });
    updated.$session(null);
    return updated;
  });
  disconnectUser(user._id);
  return user;
};
module.exports = { changeUser, Guard };
