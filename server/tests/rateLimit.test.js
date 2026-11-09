process.env.AUDIT_RATE_LIMIT_MAX = '2';
process.env.RATE_LIMIT_MAX = '1000';
process.env.RATE_LIMIT_WINDOW_MS = '60000';

jest.mock('../src/services/aiServiceClient');
const aiServiceClient = require('../src/services/aiServiceClient');

const uploadedBodies = new Map();
global.fetch = jest.fn(async (url, options = {}) => {
  const key = decodeURIComponent(String(url).split('/').pop());
  if (options.method === 'POST') {
    uploadedBodies.set(key, Buffer.from(options.body));
    return { ok: true, status: 200 };
  }
  return { ok: true, status: 200, arrayBuffer: async () => uploadedBodies.get(key) };
});

const request = require('supertest');
const app = require('../src/app');
const { connectDb, mongoose } = require('../src/db/connection');
const User = require('../src/models/user');
const Category = require('../src/models/category');
const AuditInstruction = require('../src/models/auditInstruction');
const Recording = require('../src/models/recording');
const AuditJob = require('../src/models/auditJob');

const TEST_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/call_auditing_test';
const MP3_HEADER = Buffer.concat([Buffer.from('ID3'), Buffer.alloc(13)]);

async function registerAndLogin(email) {
  await request(app).post('/auth/register').send({ email, password: 'correctpass1' });
  const login = await request(app).post('/auth/login').send({ email, password: 'correctpass1' });
  return { Authorization: `Bearer ${login.body.access_token}` };
}

async function makeAuditRequestBody(headers) {
  const category = await request(app).post('/categories').set(headers).send({ name: 'Sales' });
  await request(app)
    .post('/audit-instructions')
    .set(headers)
    .send({ categoryId: category.body._id, content: 'score it' });
  const recording = await request(app)
    .post('/recordings')
    .set(headers)
    .attach('file', Buffer.concat([MP3_HEADER, Buffer.from('audio')]), 'call.mp3');
  return { categoryId: category.body._id, recordingId: recording.body._id };
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
});

afterAll(async () => {
  await mongoose.disconnect();
});

describe('per-user audit rate limiting', () => {
  it('blocks the (N+1)th request within the window for one user, with a 409-free early reject, while a different user is untouched', async () => {
    aiServiceClient.transcribe.mockResolvedValue({ text: 't', language: 'en', duration_seconds: 1, segments: [] });
    aiServiceClient.audit.mockResolvedValue({ summary: 's', score: 5, findings: [] });

    const headersA = await registerAndLogin('ratelimit-a@example.com');
    const headersB = await registerAndLogin('ratelimit-b@example.com');

    // AUDIT_RATE_LIMIT_MAX=2 -- two distinct recordings so we hit the duplicate-run
    // 409 check's complement, not its trigger; each is its own completed job.
    const bodyA1 = await makeAuditRequestBody(headersA);
    const first = await request(app).post('/audits').set(headersA).send(bodyA1);
    expect(first.status).toBe(201);

    const bodyA2 = await makeAuditRequestBody(headersA);
    const second = await request(app).post('/audits').set(headersA).send(bodyA2);
    expect(second.status).toBe(201);

    const bodyA3 = await makeAuditRequestBody(headersA);
    const third = await request(app).post('/audits').set(headersA).send(bodyA3);
    expect(third.status).toBe(429);
    expect(third.body.error.code).toBe('rate_limited');

    const bodyB = await makeAuditRequestBody(headersB);
    const forB = await request(app).post('/audits').set(headersB).send(bodyB);
    expect(forB.status).toBe(201);
  });

  it('returns an actionable suggestion and retryAfterSeconds on 429, in the standard error envelope', async () => {
    aiServiceClient.transcribe.mockResolvedValue({ text: 't', language: 'en', duration_seconds: 1, segments: [] });
    aiServiceClient.audit.mockResolvedValue({ summary: 's', score: 5, findings: [] });

    const headers = await registerAndLogin('ratelimit-suggest@example.com');
    for (let i = 0; i < 2; i += 1) {
      const body = await makeAuditRequestBody(headers);
      await request(app).post('/audits').set(headers).send(body);
    }

    const body = await makeAuditRequestBody(headers);
    const limited = await request(app).post('/audits').set(headers).send(body);

    expect(limited.status).toBe(429);
    expect(limited.body.error).toMatchObject({ code: 'rate_limited' });
    expect(typeof limited.body.error.retryAfterSeconds).toBe('number');
    expect(limited.body.error.retryAfterSeconds).toBeGreaterThan(0);
    expect(typeof limited.body.error.suggestion).toBe('string');
  });
});
