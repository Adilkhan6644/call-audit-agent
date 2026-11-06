require('dotenv').config();
const app = require('./app');
const { connectDb } = require('./db/connection');
const { ensureBuiltinCategories } = require('./services/categories');

const port = process.env.PORT || 4000;

connectDb()
  .then(() => ensureBuiltinCategories())
  .then(() => {
    app.listen(port, () => {
      console.log(`server listening on port ${port}`);
    });
  })
  .catch((err) => {
    console.error('Failed to connect to MongoDB:', err.message);
    process.exit(1);
  });
