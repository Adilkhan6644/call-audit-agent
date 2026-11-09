const Recording = require('../models/recording');
const storage = require('./storage');
const { NotFoundError } = require('../errors');

/** The one place every route resolves "my own recording" — never 403s, to avoid confirming existence. */
async function getOwnRecording(recordingId, currentUser) {
  const recording = await Recording.findOne({ _id: recordingId, ownerId: currentUser._id });
  if (!recording) {
    throw new NotFoundError('Recording not found');
  }
  return recording;
}

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

module.exports = { getOwnRecording, deletePreviousDaysRecordings };
