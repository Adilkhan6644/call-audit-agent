const express = require('express');

const User = require('../models/user');
const { hashPassword, verifyPassword } = require('../utils/password');
const { createAccessToken } = require('../utils/jwt');
const refreshTokens = require('../services/refreshTokens');
const { ConflictError, UnauthorizedError } = require('../errors');
const authenticate = require('../middleware/auth');

const router = express.Router();

function toUserRead(user) {
  return { id: user._id, email: user.email, role: user.role, isActive: user.isActive, createdAt: user.createdAt };
}

function adminEmails() {
  return (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/** Promote-only: removing an email from ADMIN_EMAILS later never demotes an already-promoted user. */
async function syncAdminRole(user) {
  if (user.role !== 'admin' && adminEmails().includes(user.email.toLowerCase())) {
    user.role = 'admin';
    await user.save();
  }
}

/**
 * @openapi
 * /auth/register:
 *   post:
 *     tags: [Auth]
 *     summary: Register a new user
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email: { type: string }
 *               password: { type: string }
 *     responses:
 *       201: { description: Created }
 *       409: { description: Email already registered }
 */
router.post('/auth/register', async (req, res) => {
  const { email, password } = req.body;

  const existing = await User.findOne({ email });
  if (existing) {
    throw new ConflictError('Email already registered');
  }

  const hashedPassword = await hashPassword(password);
  const user = await User.create({ email, hashedPassword });
  await syncAdminRole(user);
  res.status(201).json(toUserRead(user));
});

/**
 * @openapi
 * /auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Log in and receive an access token
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email: { type: string }
 *               password: { type: string }
 *     responses:
 *       200: { description: OK }
 *       401: { description: Incorrect email or password }
 */
router.post('/auth/login', async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email });
  if (!user || !(await verifyPassword(password, user.hashedPassword))) {
    // Same generic message for wrong password and nonexistent email — no enumeration.
    throw new UnauthorizedError('Incorrect email or password');
  }

  await syncAdminRole(user);
  const accessToken = createAccessToken(user._id);
  const refreshToken = await refreshTokens.issue(user._id);
  res.json({ access_token: accessToken, refresh_token: refreshToken, token_type: 'bearer' });
});

/**
 * @openapi
 * /auth/refresh:
 *   post:
 *     tags: [Auth]
 *     summary: Exchange a refresh token for a new access/refresh token pair (rotates the refresh token)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [refresh_token]
 *             properties:
 *               refresh_token: { type: string }
 *     responses:
 *       200: { description: OK }
 *       401: { description: Refresh token missing, invalid, expired, or already used }
 */
router.post('/auth/refresh', async (req, res) => {
  const { refresh_token: refreshToken } = req.body;
  if (!refreshToken) {
    throw new UnauthorizedError();
  }

  const { accessToken, refreshToken: newRefreshToken } = await refreshTokens.rotate(refreshToken);
  res.json({ access_token: accessToken, refresh_token: newRefreshToken, token_type: 'bearer' });
});

/**
 * @openapi
 * /auth/logout:
 *   post:
 *     tags: [Auth]
 *     summary: Revoke a refresh token
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [refresh_token]
 *             properties:
 *               refresh_token: { type: string }
 *     responses:
 *       204: { description: No Content }
 */
router.post('/auth/logout', async (req, res) => {
  const { refresh_token: refreshToken } = req.body;
  if (refreshToken) {
    await refreshTokens.revoke(refreshToken);
  }
  res.status(204).send();
});

/**
 * @openapi
 * /auth/me:
 *   get:
 *     tags: [Auth]
 *     summary: Get the current authenticated user
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 *       401: { description: Missing, expired, or invalid token }
 */
router.get('/auth/me', authenticate, (req, res) => {
  res.json(toUserRead(req.user));
});

module.exports = router;
