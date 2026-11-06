const request = require('supertest');
const app = require('../src/app');
const { connectDb, mongoose } = require('../src/db/connection');
const User = require('../src/models/user');

const TEST_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/call_auditing_test';

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

describe('POST /auth/register', () => {
  it('registers successfully with no password hash in the response', async () => {
    const response = await request(app)
      .post('/auth/register')
      .send({ email: 'reg@example.com', password: 'correctpass1' });

    expect(response.status).toBe(201);
    expect(response.body.email).toBe('reg@example.com');
    expect(response.body.hashedPassword).toBeUndefined();
  });

  it('rejects a duplicate email with 409', async () => {
    await request(app).post('/auth/register').send({ email: 'dup@example.com', password: 'correctpass1' });
    const response = await request(app)
      .post('/auth/register')
      .send({ email: 'dup@example.com', password: 'correctpass1' });

    expect(response.status).toBe(409);
  });
});

describe('POST /auth/login', () => {
  beforeEach(async () => {
    await request(app).post('/auth/register').send({ email: 'login@example.com', password: 'correctpass1' });
  });

  it('returns an access token for correct credentials', async () => {
    const response = await request(app)
      .post('/auth/login')
      .send({ email: 'login@example.com', password: 'correctpass1' });

    expect(response.status).toBe(200);
    expect(response.body.access_token).toBeDefined();
  });

  it('returns 401 for wrong password', async () => {
    const response = await request(app)
      .post('/auth/login')
      .send({ email: 'login@example.com', password: 'wrongpass' });
    expect(response.status).toBe(401);
  });

  it('returns the identical message for a nonexistent email (no enumeration)', async () => {
    const wrongPassword = await request(app)
      .post('/auth/login')
      .send({ email: 'login@example.com', password: 'wrongpass' });
    const nonexistentEmail = await request(app)
      .post('/auth/login')
      .send({ email: 'nobody@example.com', password: 'whatever1' });

    expect(wrongPassword.body.error.message).toBe(nonexistentEmail.body.error.message);
  });
});

describe('GET /auth/me', () => {
  it('returns 200 for a valid token', async () => {
    await request(app).post('/auth/register').send({ email: 'me@example.com', password: 'correctpass1' });
    const login = await request(app)
      .post('/auth/login')
      .send({ email: 'me@example.com', password: 'correctpass1' });

    const response = await request(app)
      .get('/auth/me')
      .set('Authorization', `Bearer ${login.body.access_token}`);

    expect(response.status).toBe(200);
    expect(response.body.email).toBe('me@example.com');
  });

  it('returns 401 for a missing token', async () => {
    const response = await request(app).get('/auth/me');
    expect(response.status).toBe(401);
  });

  it('returns 401 for a tampered token', async () => {
    const response = await request(app).get('/auth/me').set('Authorization', 'Bearer not-a-real-token');
    expect(response.status).toBe(401);
  });
});
