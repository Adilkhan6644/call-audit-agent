const app = require('../src/app');
const { connectDb } = require('../src/db/connection');
const { ensureBuiltinCategories } = require('../src/services/categories');

let ready;
function ensureReady() {
  if (!ready) {
    ready = connectDb().then(() => ensureBuiltinCategories());
  }
  return ready;
}

module.exports = async (req, res) => {
  await ensureReady();
  return app(req, res);
};
