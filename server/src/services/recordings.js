const Recording = require('../models/recording');
const storage = require('./storage');

/** Keep only today's recordings for this user; delete everything older (DB + storage). */
async function deletePreviousDaysRecordings(ownerId) {
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);

  const stale = await Recording.find({ ownerId, createdAt: { $lt: todayStart } });
  if (stale.length === 0) {
    return;
  }

  await storage.deleteMany(stale.map((r) => r.storageKey));
  await Recording.deleteMany({ _id: { $in: stale.map((r) => r._id) } });
}

module.exports = { deletePreviousDaysRecordings };
