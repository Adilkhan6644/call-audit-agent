const request = require('supertest');

const app = require('../src/app');
const { connectDb, mongoose } = require('../src/db/connection');
const User = require('../src/models/user');
const ApiKeySetting = require('../src/models/apiKeySetting');

const TEST_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/call_auditing_test';

async function registerAndLogin(email) {
  await request(app).post('/auth/register').send({ email, password: 'correctpass1' });
  const login = await request(app).post('/auth/login').send({ email, password: 'correctpass1' });
  return { Authorization: `Bearer ${login.body.access_token}` };
}

async function registerAdmin(email) {
  process.env.ADMIN_EMAILS = email;
  return registerAndLogin(email);
}

beforeAll(async () => {
  await connectDb(TEST_URI);
  await User.syncIndexes();
});

afterEach(async () => {
  await User.deleteMany({});
  await ApiKeySetting.deleteMany({});
});

afterAll(async () => {
  await mongoose.disconnect();
});

describe('GET /admin/api-keys', () => {
  it('rejects a non-admin with 403', async () => {
    const headers = await registerAndLogin('plain@example.com');
    const response = await request(app).get('/admin/api-keys').set(headers);
    expect(response.status).toBe(403);
  });

  it('reports configured: false and no key material when nothing is set', async () => {
    const headers = await registerAdmin('admin-empty@example.com');
    const response = await request(app).get('/admin/api-keys').set(headers);

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(3);
    response.body.forEach((entry) => {
      expect(entry.configured).toBe(false);
      expect(entry.last4).toBeNull();
    });
    expect(JSON.stringify(response.body)).not.toContain('sk-');
  });

  it('shows last4 after a key is set directly, and never the full value', async () => {
    const headers = await registerAdmin('admin-withkey@example.com');
    const admin = await User.findOne({ email: 'admin-withkey@example.com' });
    await ApiKeySetting.create({ provider: 'openai', value: 'sk-test-abcdEFGH1234', updatedBy: admin._id });

    const response = await request(app).get('/admin/api-keys').set(headers);
    const openaiEntry = response.body.find((e) => e.provider === 'openai');

    expect(openaiEntry.configured).toBe(true);
    expect(openaiEntry.last4).toBe('1234');
    expect(JSON.stringify(response.body)).not.toContain('sk-test-abcdEFGH1234');
  });
});
