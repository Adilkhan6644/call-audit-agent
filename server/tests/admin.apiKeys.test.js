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

describe('PUT /admin/api-keys/:provider', () => {
  it('rejects an unknown provider with 422', async () => {
    const headers = await registerAdmin('rotate-badprovider@example.com');
    const response = await request(app).put('/admin/api-keys/claude').set(headers).send({ value: 'sk-x' });
    expect(response.status).toBe(422);
  });

  it('rejects an empty value with 422', async () => {
    const headers = await registerAdmin('rotate-empty@example.com');
    const response = await request(app).put('/admin/api-keys/openai').set(headers).send({ value: '' });
    expect(response.status).toBe(422);
  });

  it('rotates the key and returns only a masked body, never the full value, and never logs it', async () => {
    const headers = await registerAdmin('rotate-ok@example.com');
    const rawValue = 'sk-live-superSecretValue9999';
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const response = await request(app).put('/admin/api-keys/openai').set(headers).send({ value: rawValue });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ provider: 'openai', configured: true, last4: '9999', updatedAt: expect.any(String) });
    expect(response.text).not.toContain(rawValue);

    const loggedAnywhere = [...logSpy.mock.calls, ...errorSpy.mock.calls].some((args) =>
      args.some((arg) => String(arg).includes(rawValue))
    );
    expect(loggedAnywhere).toBe(false);

    logSpy.mockRestore();
    errorSpy.mockRestore();
  });
});
