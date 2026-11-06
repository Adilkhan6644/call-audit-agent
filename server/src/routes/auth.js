const express = require('express');

const User = require('../models/user');
const { hashPassword, verifyPassword } = require('../utils/password');
const { createAccessToken } = require('../utils/jwt');
const { ConflictError, UnauthorizedError } = require('../errors');
const authenticate = require('../middleware/auth');

const router = express.Router();

function toUserRead(user) {
  return { id: user._id, email: user.email, isActive: user.isActive, createdAt: user.createdAt };
}

router.post('/auth/register', async (req, res) => {
  const { email, password } = req.body;

  const existing = await User.findOne({ email });
  if (existing) {
    throw new ConflictError('Email already registered');
  }

  const hashedPassword = await hashPassword(password);
  const user = await User.create({ email, hashedPassword });
  res.status(201).json(toUserRead(user));
});

router.post('/auth/login', async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email });
  if (!user || !(await verifyPassword(password, user.hashedPassword))) {
    // Same generic message for wrong password and nonexistent email — no enumeration.
    throw new UnauthorizedError('Incorrect email or password');
  }

  const accessToken = createAccessToken(user._id);
  res.json({ access_token: accessToken, token_type: 'bearer' });
});

router.get('/auth/me', authenticate, (req, res) => {
  res.json(toUserRead(req.user));
});

module.exports = router;
