const express = require('express');

const Category = require('../models/category');
const authenticate = require('../middleware/auth');
const { ForbiddenError } = require('../errors');
const { getVisibleCategory } = require('../services/categories');

const router = express.Router();
router.use(authenticate);

/**
 * @openapi
 * /categories:
 *   get:
 *     tags: [Categories]
 *     summary: List built-in categories and your own custom categories
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 */
router.get('/categories', async (req, res) => {
  const categories = await Category.find({
    $or: [{ ownerId: null }, { ownerId: req.user._id }],
  });
  res.json(categories);
});

/**
 * @openapi
 * /categories:
 *   post:
 *     tags: [Categories]
 *     summary: Create a custom category
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name: { type: string }
 *     responses:
 *       201: { description: Created }
 */
router.post('/categories', async (req, res) => {
  const category = await Category.create({
    name: req.body.name,
    isBuiltin: false,
    ownerId: req.user._id,
  });
  res.status(201).json(category);
});

/**
 * @openapi
 * /categories/{id}:
 *   get:
 *     tags: [Categories]
 *     summary: Get a single category by id
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: OK }
 *       404: { description: Not found or not owned }
 */
router.get('/categories/:id', async (req, res) => {
  const category = await getVisibleCategory(req.params.id, req.user);
  res.json(category);
});

/**
 * @openapi
 * /categories/{id}:
 *   patch:
 *     tags: [Categories]
 *     summary: Rename a custom category you own
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *     responses:
 *       200: { description: OK }
 *       403: { description: Built-in categories cannot be modified }
 *       404: { description: Not found or not owned }
 */
router.patch('/categories/:id', async (req, res) => {
  const category = await getVisibleCategory(req.params.id, req.user);
  if (category.isBuiltin) {
    throw new ForbiddenError('Built-in categories cannot be modified');
  }
  category.name = req.body.name;
  await category.save();
  res.json(category);
});

/**
 * @openapi
 * /categories/{id}:
 *   delete:
 *     tags: [Categories]
 *     summary: Delete a custom category you own
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       204: { description: Deleted }
 *       403: { description: Built-in categories cannot be deleted }
 *       404: { description: Not found or not owned }
 */
router.delete('/categories/:id', async (req, res) => {
  const category = await getVisibleCategory(req.params.id, req.user);
  if (category.isBuiltin) {
    throw new ForbiddenError('Built-in categories cannot be deleted');
  }
  await category.deleteOne();
  res.status(204).end();
});

module.exports = router;
