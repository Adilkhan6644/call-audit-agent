const mongoose = require('mongoose');

const Category = require('../models/category');
const { NotFoundError } = require('../errors');

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

async function getVisibleCategory(categoryId, currentUser) {
  if (!mongoose.isValidObjectId(categoryId)) {
    throw new NotFoundError('Category not found');
  }
  const category = await Category.findOne({
    _id: categoryId,
    $or: [{ ownerId: null }, { ownerId: currentUser._id }],
  });
  if (!category) {
    throw new NotFoundError('Category not found');
  }
  return category;
}

module.exports = { ensureBuiltinCategories, getVisibleCategory, BUILTIN_CATEGORY_NAMES };
