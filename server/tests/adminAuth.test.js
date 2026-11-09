const express = require('express');
const request = require('supertest');

const authApp = require('../src/app');
const { connectDb, mongoose } = require('../src/db/connection');
const User = require('../src/models/user');
const authenticate = require('../src/middleware/auth');
const adminOnly = require('../src/middleware/adminOnly');
const { createAccessToken } = require('../src/utils/jwt');

const TEST_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/call_auditing_test';

// A separate minimal app for probing adminOnly directly — authApp's catch-all
// 404/error handlers are already registered by the time it's required, so a
// route mounted afterward on authApp would never be reached.
const probeApp = express();
probeApp.get('/admin/_probe', authenticate, adminOnly, (req, res) => res.json({ ok: true }));

async function register(email) {
  await request(authApp).post('/auth/register').send({ email, password: 'correctpass1' });
  return User.findOne({ email });
}

async function login(email) {
  const response = await request(authApp).post('/auth/login').send({ email, password: 'correctpass1' });
  return { Authorization: `Bearer ${response.body.access_token}` };
}

beforeAll(async () => {
  await connectDb(TEST_URI);
  await User.syncIndexes();
});

afterEach(async () => {
  await User.deleteMany({});
});

afterAll(async () => {
  await mongoose.disconnect();
});

describe('ADMIN_EMAILS bootstrap', () => {
  it('leaves a user not on the list as role "user"', async () => {
    process.env.ADMIN_EMAILS = 'boss@example.com';
    const user = await register('nobody@example.com');
    expect(user.role).toBe('user');
  });

  it('promotes a user on ADMIN_EMAILS to admin on first login, and does not demote them after removal from the list', async () => {
    process.env.ADMIN_EMAILS = 'boss@example.com';
    await register('boss@example.com');
    await login('boss@example.com');

    const promoted = await User.findOne({ email: 'boss@example.com' });
    expect(promoted.role).toBe('admin');

    process.env.ADMIN_EMAILS = '';
    await login('boss@example.com');

    const stillAdmin = await User.findOne({ email: 'boss@example.com' });
    expect(stillAdmin.role).toBe('admin');
  });
});

describe('adminOnly middleware', () => {
  it('blocks a non-admin with 403, same generic shape as a client-supplied role claim would get', async () => {
    const user = await User.create({ email: 'nonadmin@example.com', hashedPassword: 'x', role: 'user' });
    const headers = { Authorization: `Bearer ${createAccessToken(user._id)}` };

    const response = await request(probeApp).get('/admin/_probe').set(headers);
    expect(response.status).toBe(403);
  });

  it('allows an admin through', async () => {
    const user = await User.create({ email: 'admin@example.com', hashedPassword: 'x', role: 'admin' });
    const headers = { Authorization: `Bearer ${createAccessToken(user._id)}` };

    const response = await request(probeApp).get('/admin/_probe').set(headers);
    expect(response.status).toBe(200);
  });
});
