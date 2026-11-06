const request = require('supertest');
const app = require('../src/app');
const { connectDb, mongoose } = require('../src/db/connection');

const TEST_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/call_auditing_test';

describe('GET /readiness', () => {
  it('returns not_ready before the db connects', async () => {
    const response = await request(app).get('/readiness');
    expect(response.status).toBe(503);
    expect(response.body.db).toBe('disconnected');
  });

  it('returns ready once the db connects', async () => {
    await connectDb(TEST_URI);
    const response = await request(app).get('/readiness');
    expect(response.status).toBe(200);
    expect(response.body.db).toBe('connected');
    await mongoose.disconnect();
  });
});
