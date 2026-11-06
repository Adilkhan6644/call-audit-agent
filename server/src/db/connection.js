const mongoose = require('mongoose');

function connectDb(uri = process.env.MONGODB_URI) {
  return mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
}

function isConnected() {
  return mongoose.connection.readyState === 1;
}

module.exports = { connectDb, isConnected, mongoose };
