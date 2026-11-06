const Category = require('../models/category');

const BUILTIN_CATEGORY_NAMES = [
  'Medical Billing',
  'Sales Support',
  'Front Desk / Patient Services',
  'Customer Support / Service',
  'Collections / Payment Follow-up',
];

async function ensureBuiltinCategories() {
  const existing = await Category.countDocuments({ isBuiltin: true });
  if (existing > 0) {
    return;
  }
  await Category.insertMany(
    BUILTIN_CATEGORY_NAMES.map((name) => ({ name, isBuiltin: true, ownerId: null }))
  );
}

module.exports = { ensureBuiltinCategories, BUILTIN_CATEGORY_NAMES };
