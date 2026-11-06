const express = require('express');
const mongoose = require('mongoose');

const Category = require('../models/category');
const authenticate = require('../middleware/auth');
const { ForbiddenError, NotFoundError } = require('../errors');

const router = express.Router();
router.use(authenticate);

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

router.get('/categories', async (req, res) => {
  const categories = await Category.find({
    $or: [{ ownerId: null }, { ownerId: req.user._id }],
  });
  res.json(categories);
});

router.post('/categories', async (req, res) => {
  const category = await Category.create({
    name: req.body.name,
    isBuiltin: false,
    ownerId: req.user._id,
  });
  res.status(201).json(category);
});

router.get('/categories/:id', async (req, res) => {
  const category = await getVisibleCategory(req.params.id, req.user);
  res.json(category);
});

router.patch('/categories/:id', async (req, res) => {
  const category = await getVisibleCategory(req.params.id, req.user);
  if (category.isBuiltin) {
    throw new ForbiddenError('Built-in categories cannot be modified');
  }
  category.name = req.body.name;
  await category.save();
  res.json(category);
});

router.delete('/categories/:id', async (req, res) => {
  const category = await getVisibleCategory(req.params.id, req.user);
  if (category.isBuiltin) {
    throw new ForbiddenError('Built-in categories cannot be deleted');
  }
  await category.deleteOne();
  res.status(204).end();
});

module.exports = router;
