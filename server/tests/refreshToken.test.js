const request = require('supertest');
const app = require('../src/app');
const { connectDb, mongoose } = require('../src/db/connection');
const User = require('../src/models/user');
const RefreshToken = require('../src/models/refreshToken');

const TEST_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/call_auditing_test';

async function registerAndLogin(email) {
  await request(app).post('/auth/register').send({ email, password: 'correctpass1' });
  return request(app).post('/auth/login').send({ email, password: 'correctpass1' });
}

beforeAll(async () => {
  await connectDb(TEST_URI);
  await User.syncIndexes();
  await RefreshToken.syncIndexes();
});

afterEach(async () => {
  await User.deleteMany({});
  await RefreshToken.deleteMany({});
});

afterAll(async () => {
  await mongoose.disconnect();
});

describe('POST /auth/login', () => {
  it('also returns a refresh token', async () => {
    const login = await registerAndLogin('refresh-login@example.com');
    expect(login.body.refresh_token).toBeDefined();
  });
});

describe('POST /auth/refresh', () => {
  it('exchanges a valid refresh token for a new pair', async () => {
    const login = await registerAndLogin('refresh-ok@example.com');

    const response = await request(app)
      .post('/auth/refresh')
      .send({ refresh_token: login.body.refresh_token });

    expect(response.status).toBe(200);
    expect(response.body.access_token).toBeDefined();
    expect(response.body.refresh_token).toBeDefined();
    expect(response.body.refresh_token).not.toBe(login.body.refresh_token);
  });

  it('rejects a reused (already-rotated) refresh token with 401', async () => {
    const login = await registerAndLogin('refresh-reuse@example.com');
    await request(app).post('/auth/refresh').send({ refresh_token: login.body.refresh_token });

    const reuse = await request(app)
      .post('/auth/refresh')
      .send({ refresh_token: login.body.refresh_token });

    expect(reuse.status).toBe(401);
  });

  it('rejects a garbage token with 401', async () => {
    const response = await request(app).post('/auth/refresh').send({ refresh_token: 'not-a-real-token' });
    expect(response.status).toBe(401);
  });

  it('rejects a missing token with 401', async () => {
    const response = await request(app).post('/auth/refresh').send({});
    expect(response.status).toBe(401);
  });

  it('new access token from rotation works against a protected route', async () => {
    const login = await registerAndLogin('refresh-chain@example.com');
    const refreshed = await request(app)
      .post('/auth/refresh')
      .send({ refresh_token: login.body.refresh_token });

    const me = await request(app)
      .get('/auth/me')
      .set('Authorization', `Bearer ${refreshed.body.access_token}`);

    expect(me.status).toBe(200);
    expect(me.body.email).toBe('refresh-chain@example.com');
  });
});

describe('POST /auth/logout', () => {
  it('revokes the refresh token so it can no longer be used', async () => {
    const login = await registerAndLogin('logout-ok@example.com');

    const logout = await request(app).post('/auth/logout').send({ refresh_token: login.body.refresh_token });
    expect(logout.status).toBe(204);

    const afterLogout = await request(app)
      .post('/auth/refresh')
      .send({ refresh_token: login.body.refresh_token });
    expect(afterLogout.status).toBe(401);
  });

  it('returns 204 even with no refresh token given', async () => {
    const response = await request(app).post('/auth/logout').send({});
    expect(response.status).toBe(204);
  });
});
