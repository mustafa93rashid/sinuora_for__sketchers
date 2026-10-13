const mongoose = require("mongoose");

// ==================== Transaction Helper ====================

const runTransaction = async (callback, existingSession = null) => {

  // ==================== Use Existing Session ====================

  if (existingSession) {
    if (!existingSession.inTransaction()) throw new Error("An active transaction is required");
    return callback(existingSession);
  }

  // ==================== Create Session ====================

  const session = await mongoose.startSession();

  try {
    let result;

    // ==================== Execute Transaction ====================

    await session.withTransaction(async () => {
      result = await callback(session);
    });

    // ==================== Return Result ====================

    return result;

  } finally {

    // ==================== End Session ====================

    await session.endSession();
  }
};

// ==================== Export ====================

module.exports = runTransaction;