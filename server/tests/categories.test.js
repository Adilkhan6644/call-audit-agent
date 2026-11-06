const request = require('supertest');
const app = require('../src/app');
const { connectDb, mongoose } = require('../src/db/connection');
const User = require('../src/models/user');
const Category = require('../src/models/category');
const { ensureBuiltinCategories, BUILTIN_CATEGORY_NAMES } = require('../src/services/categories');

const TEST_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/call_auditing_test';

async function registerAndLogin(email) {
  await request(app).post('/auth/register').send({ email, password: 'correctpass1' });
  const login = await request(app).post('/auth/login').send({ email, password: 'correctpass1' });
  return { Authorization: `Bearer ${login.body.access_token}` };
}

beforeAll(async () => {
  await connectDb(TEST_URI);
  await User.syncIndexes();
});

afterEach(async () => {
  await User.deleteMany({});
  await Category.deleteMany({ isBuiltin: false });
});

afterAll(async () => {
  await mongoose.disconnect();
});

describe('built-in category seeding', () => {
  it('seeds exactly the fixed built-ins, idempotently', async () => {
    await ensureBuiltinCategories();
    await ensureBuiltinCategories();
    const builtins = await Category.find({ isBuiltin: true });
    expect(builtins.length).toBe(BUILTIN_CATEGORY_NAMES.length);
  });
});

describe('GET /categories', () => {
  it('shows built-ins plus own customs, never another user\'s customs', async () => {
    await ensureBuiltinCategories();
    const headersA = await registerAndLogin('cata@example.com');
    const headersB = await registerAndLogin('catb@example.com');

    await request(app).post('/categories').set(headersA).send({ name: 'A-only' });

    const response = await request(app).get('/categories').set(headersB);
    const names = response.body.map((c) => c.name);

    expect(names).not.toContain('A-only');
    expect(names.length).toBe(BUILTIN_CATEGORY_NAMES.length);
  });
});

describe('POST /categories', () => {
  it('always sets ownerId server-side, ignoring any client-supplied value', async () => {
    const headers = await registerAndLogin('catowner@example.com');
    const response = await request(app)
      .post('/categories')
      .set(headers)
      .send({ name: 'Mine', ownerId: '000000000000000000000000' });

    const me = await request(app).get('/auth/me').set(headers);
    expect(String(response.body.ownerId)).toBe(String(me.body.id));
  });
});

describe('category ownership on retrieve/update/delete', () => {
  it('404s on another user\'s custom category, 403s on mutating a built-in', async () => {
    await ensureBuiltinCategories();
    const headersA = await registerAndLogin('ownA@example.com');
    const headersB = await registerAndLogin('ownB@example.com');

    const created = await request(app).post('/categories').set(headersA).send({ name: 'Private' });

    const otherGet = await request(app).get(`/categories/${created.body._id}`).set(headersB);
    expect(otherGet.status).toBe(404);

    const builtin = await Category.findOne({ isBuiltin: true });
    const mutateBuiltin = await request(app)
      .patch(`/categories/${builtin._id}`)
      .set(headersA)
      .send({ name: 'Hacked' });
    expect(mutateBuiltin.status).toBe(403);

    const deleteOwn = await request(app).delete(`/categories/${created.body._id}`).set(headersA);
    expect(deleteOwn.status).toBe(204);
  });
});
