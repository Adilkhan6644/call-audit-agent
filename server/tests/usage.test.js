jest.mock('../src/services/aiServiceClient');
const aiServiceClient = require('../src/services/aiServiceClient');

global.fetch = jest.fn(async (url, options = {}) => {
  if (options.method === 'POST') return { ok: true, status: 200 };
  return { ok: true, status: 200, arrayBuffer: async () => Buffer.from('audio') };
});

const request = require('supertest');
const app = require('../src/app');
const { connectDb, mongoose } = require('../src/db/connection');
const User = require('../src/models/user');
const Category = require('../src/models/category');
const AuditInstruction = require('../src/models/auditInstruction');
const Recording = require('../src/models/recording');
const AuditJob = require('../src/models/auditJob');
const UsageRecord = require('../src/models/usageRecord');

const TEST_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/call_auditing_test';
const MP3_HEADER = Buffer.concat([Buffer.from('ID3'), Buffer.alloc(13)]);

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
  jest.clearAllMocks();
  await User.deleteMany({});
  await Category.deleteMany({});
  await AuditInstruction.deleteMany({});
  await Recording.deleteMany({});
  await AuditJob.deleteMany({});
  await UsageRecord.deleteMany({});
});

afterAll(async () => {
  await mongoose.disconnect();
});

describe('usage tracking', () => {
  it('increments usage when the pipeline completes a run, and GET /usage reports the total', async () => {
    const headers = await registerAndLogin('usage@example.com');
    const category = await request(app).post('/categories').set(headers).send({ name: 'Sales' });
    await request(app)
      .post('/audit-instructions')
      .set(headers)
      .send({ categoryId: category.body._id, content: 'Score it.' });
    const recording = await request(app)
      .post('/recordings')
      .set(headers)
      .attach('file', Buffer.concat([MP3_HEADER, Buffer.from('audio')]), 'call.mp3');

    aiServiceClient.transcribe.mockResolvedValue({ text: 't', language: 'en', duration_seconds: 1, segments: [] });
    aiServiceClient.audit.mockResolvedValue({ summary: 's', score: 5, findings: [] });

    const before = await request(app).get('/usage').set(headers);
    expect(before.body.total).toBe(0);

    await request(app)
      .post('/audits')
      .set(headers)
      .send({ categoryId: category.body._id, recordingId: recording.body._id });

    const after = await request(app).get('/usage').set(headers);
    expect(after.body.total).toBe(1);
  });

  it('does not increment usage on a failed run', async () => {
    const headers = await registerAndLogin('usage-fail@example.com');
    const category = await request(app).post('/categories').set(headers).send({ name: 'Sales' });
    await request(app)
      .post('/audit-instructions')
      .set(headers)
      .send({ categoryId: category.body._id, content: 'Score it.' });
    const recording = await request(app)
      .post('/recordings')
      .set(headers)
      .attach('file', Buffer.concat([MP3_HEADER, Buffer.from('audio')]), 'call.mp3');

    aiServiceClient.transcribe.mockRejectedValue(new Error('boom'));

    await request(app)
      .post('/audits')
      .set(headers)
      .send({ categoryId: category.body._id, recordingId: recording.body._id });

    const after = await request(app).get('/usage').set(headers);
    expect(after.body.total).toBe(0);
  });
});
