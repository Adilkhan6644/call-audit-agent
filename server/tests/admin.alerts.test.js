const request = require('supertest');

const app = require('../src/app');
const { connectDb, mongoose } = require('../src/db/connection');
const User = require('../src/models/user');
const AdminAlert = require('../src/models/adminAlert');
const { raiseProviderQuotaAlert } = require('../src/services/adminAlerts');

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
  await AdminAlert.deleteMany({});
});

afterAll(async () => {
  await mongoose.disconnect();
});

describe('GET /admin/alerts', () => {
  it('rejects a non-admin with 403', async () => {
    const headers = await registerAndLogin('alerts-plain@example.com');
    const response = await request(app).get('/admin/alerts').set(headers);
    expect(response.status).toBe(403);
  });

  it('shows the unresolved alert raised by a quota failure, by default', async () => {
    const headers = await registerAdmin('alerts-admin@example.com');
    await raiseProviderQuotaAlert('Groq out of credits');

    const response = await request(app).get('/admin/alerts').set(headers);
    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(1);
    expect(response.body[0].type).toBe('provider_quota_exceeded');
    expect(response.body[0].resolved).toBe(false);
  });
});

describe('PATCH /admin/alerts/:id/resolve', () => {
  it('rejects a non-admin with 403', async () => {
    const headers = await registerAndLogin('resolve-plain@example.com');
    const alert = await raiseProviderQuotaAlert('Groq out of credits');
    const response = await request(app).patch(`/admin/alerts/${alert._id}/resolve`).set(headers);
    expect(response.status).toBe(403);
  });

  it('resolving removes it from the default (unresolved) list, but it stays visible with ?resolved=true', async () => {
    const headers = await registerAdmin('resolve-admin@example.com');
    const alert = await raiseProviderQuotaAlert('Groq out of credits');

    const resolveResponse = await request(app).patch(`/admin/alerts/${alert._id}/resolve`).set(headers);
    expect(resolveResponse.status).toBe(200);
    expect(resolveResponse.body.resolved).toBe(true);

    const unresolvedList = await request(app).get('/admin/alerts').set(headers);
    expect(unresolvedList.body).toHaveLength(0);

    const resolvedList = await request(app).get('/admin/alerts').query({ resolved: 'true' }).set(headers);
    expect(resolvedList.body).toHaveLength(1);
    expect(resolvedList.body[0]._id).toBe(String(alert._id));
  });

  it('returns 404 for an unknown alert id', async () => {
    const headers = await registerAdmin('resolve-404@example.com');
    const response = await request(app)
      .patch(`/admin/alerts/${new mongoose.Types.ObjectId()}/resolve`)
      .set(headers);
    expect(response.status).toBe(404);
  });
});
