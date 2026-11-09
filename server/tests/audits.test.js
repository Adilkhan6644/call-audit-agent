jest.mock('../src/services/aiServiceClient');
const aiServiceClient = require('../src/services/aiServiceClient');

// Fakes the Supabase network boundary the same way recordings.test.js does.
const uploadedBodies = new Map();
global.fetch = jest.fn(async (url, options = {}) => {
  const key = decodeURIComponent(String(url).split('/').pop());
  if (options.method === 'POST') {
    uploadedBodies.set(key, Buffer.from(options.body));
    return { ok: true, status: 200 };
  }
  if (options.method === 'DELETE') {
    const { prefixes } = JSON.parse(options.body);
    prefixes.forEach((k) => uploadedBodies.delete(k));
    return { ok: true, status: 200 };
  }
  const body = uploadedBodies.get(key);
  return { ok: true, status: 200, arrayBuffer: async () => body };
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

async function setupCategoryInstructionAndRecording(headers) {
  const category = await request(app).post('/categories').set(headers).send({ name: 'Sales' });
  await request(app)
    .post('/audit-instructions')
    .set(headers)
    .send({ categoryId: category.body._id, content: 'Score politeness 1-10.' });
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

describe('POST /audits', () => {
  it('runs the pipeline end to end and reaches completed with a valid stored result', async () => {
    const headers = await registerAndLogin('audit-ok@example.com');
    const { categoryId, recordingId } = await setupCategoryInstructionAndRecording(headers);

    aiServiceClient.transcribe.mockResolvedValue({ text: 'the transcript', language: 'en', duration_seconds: 3, segments: [] });
    aiServiceClient.audit.mockResolvedValue({ summary: 'Polite throughout.', score: 9, findings: [] });

    const response = await request(app).post('/audits').set(headers).send({ categoryId, recordingId });

    expect(response.status).toBe(201);
    expect(response.body.status).toBe('completed');
    expect(response.body.result).toEqual({ summary: 'Polite throughout.', score: 9, findings: [] });
    expect(aiServiceClient.audit).toHaveBeenCalledWith('the transcript', 'Score politeness 1-10.');
  });

  it('marks the job failed with a sanitized message and no partial result on AI-service failure', async () => {
    const headers = await registerAndLogin('audit-fail@example.com');
    const { categoryId, recordingId } = await setupCategoryInstructionAndRecording(headers);

    aiServiceClient.transcribe.mockRejectedValue(new Error('upstream 502 containing transcript details'));

    const response = await request(app).post('/audits').set(headers).send({ categoryId, recordingId });

    expect(response.status).toBe(201);
    expect(response.body.status).toBe('failed');
    expect(response.body.result).toBeNull();
    expect(response.body.errorMessage).toBe('Audit processing failed');
  });

  it('blocks a second concurrent run for the same recording with 409, but allows a re-run after completion', async () => {
    const headers = await registerAndLogin('audit-dup@example.com');
    const { categoryId, recordingId } = await setupCategoryInstructionAndRecording(headers);

    await AuditJob.create({
      recordingId,
      instructionId: new mongoose.Types.ObjectId(),
      categoryId,
      ownerId: (await request(app).get('/auth/me').set(headers)).body.id,
      status: 'processing',
    });

    const duplicate = await request(app).post('/audits').set(headers).send({ categoryId, recordingId });
    expect(duplicate.status).toBe(409);

    await AuditJob.deleteMany({ recordingId });
    aiServiceClient.transcribe.mockResolvedValue({ text: 't', language: 'en', duration_seconds: 1, segments: [] });
    aiServiceClient.audit.mockResolvedValue({ summary: 's', score: 5, findings: [] });

    const rerun = await request(app).post('/audits').set(headers).send({ categoryId, recordingId });
    expect(rerun.status).toBe(201);
    expect(rerun.body.status).toBe('completed');
  });

  it('rejects another user\'s recording with 404', async () => {
    const headersA = await registerAndLogin('audit-a@example.com');
    const headersB = await registerAndLogin('audit-b@example.com');
    const { categoryId, recordingId } = await setupCategoryInstructionAndRecording(headersA);

    const response = await request(app).post('/audits').set(headersB).send({ categoryId, recordingId });
    expect(response.status).toBe(404);
  });
});

describe('GET /audits', () => {
  it('filters, paginates, and never surfaces another user\'s jobs', async () => {
    const headersA = await registerAndLogin('list-a@example.com');
    const headersB = await registerAndLogin('list-b@example.com');
    const ownerId = (await request(app).get('/auth/me').set(headersA)).body.id;

    const { categoryId: catOther } = await setupCategoryInstructionAndRecording(headersA);
    const { categoryId, recordingId: rec1 } = await setupCategoryInstructionAndRecording(headersA);
    const recording2 = await request(app)
      .post('/recordings')
      .set(headersA)
      .attach('file', Buffer.concat([MP3_HEADER, Buffer.from('audio2')]), 'call2.mp3');

    await AuditJob.create({ recordingId: rec1, instructionId: new mongoose.Types.ObjectId(), categoryId, ownerId, status: 'completed' });
    await AuditJob.create({ recordingId: recording2.body._id, instructionId: new mongoose.Types.ObjectId(), categoryId, ownerId, status: 'failed' });
    await AuditJob.create({ recordingId: new mongoose.Types.ObjectId(), instructionId: new mongoose.Types.ObjectId(), categoryId: catOther, ownerId, status: 'completed' });

    const otherOwnerId = (await request(app).get('/auth/me').set(headersB)).body.id;
    await AuditJob.create({ recordingId: new mongoose.Types.ObjectId(), instructionId: new mongoose.Types.ObjectId(), categoryId, ownerId: otherOwnerId, status: 'completed' });

    const byStatus = await request(app).get('/audits').query({ status: 'failed' }).set(headersA);
    expect(byStatus.body.items).toHaveLength(1);
    expect(byStatus.body.items[0].status).toBe('failed');

    const byCategory = await request(app).get('/audits').query({ categoryId }).set(headersA);
    expect(byCategory.body.total).toBe(2);

    const page1 = await request(app).get('/audits').query({ pageSize: 2, page: 1 }).set(headersA);
    expect(page1.body.items).toHaveLength(2);
    expect(page1.body.total).toBe(3);

    const forB = await request(app).get('/audits').set(headersB);
    expect(forB.body.total).toBe(1);
    expect(forB.body.items[0].ownerId).toBe(otherOwnerId);
  });
});

describe('GET /audits/export.csv', () => {
  it('is ownership-gated and includes only the caller\'s own jobs', async () => {
    const headersA = await registerAndLogin('export-a@example.com');
    const headersB = await registerAndLogin('export-b@example.com');
    const { categoryId, recordingId } = await setupCategoryInstructionAndRecording(headersA);

    aiServiceClient.transcribe.mockResolvedValue({ text: 't', language: 'en', duration_seconds: 1, segments: [] });
    aiServiceClient.audit.mockResolvedValue({ summary: 'export me', score: 7, findings: [] });
    const created = await request(app).post('/audits').set(headersA).send({ categoryId, recordingId });

    const csvA = await request(app).get('/audits/export.csv').set(headersA);
    expect(csvA.status).toBe(200);
    expect(csvA.text).toContain('export me');
    expect(csvA.text).toContain(String(created.body._id));

    const csvB = await request(app).get('/audits/export.csv').set(headersB);
    expect(csvB.text).not.toContain('export me');
  });
});

describe('GET /audits/export.pdf', () => {
  it('is ownership-gated and returns a non-empty PDF', async () => {
    const headersA = await registerAndLogin('pdf-a@example.com');
    const headersB = await registerAndLogin('pdf-b@example.com');
    const { categoryId, recordingId } = await setupCategoryInstructionAndRecording(headersA);

    aiServiceClient.transcribe.mockResolvedValue({ text: 't', language: 'en', duration_seconds: 1, segments: [] });
    aiServiceClient.audit.mockResolvedValue({ summary: 's', score: 5, findings: [] });
    await request(app).post('/audits').set(headersA).send({ categoryId, recordingId });

    const pdfA = await request(app).get('/audits/export.pdf').set(headersA).buffer().parse((res, callback) => {
      res.setEncoding('binary');
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => callback(null, Buffer.from(data, 'binary')));
    });
    expect(pdfA.status).toBe(200);
    expect(pdfA.body.subarray(0, 4).toString('latin1')).toBe('%PDF');

    const pdfB = await request(app).get('/audits/export.pdf').set(headersB);
    expect(pdfB.status).toBe(200);
  });
});

describe('GET /audits/:id', () => {
  it('is owner-scoped', async () => {
    const headersA = await registerAndLogin('getaudit-a@example.com');
    const headersB = await registerAndLogin('getaudit-b@example.com');
    const { categoryId, recordingId } = await setupCategoryInstructionAndRecording(headersA);

    aiServiceClient.transcribe.mockResolvedValue({ text: 't', language: 'en', duration_seconds: 1, segments: [] });
    aiServiceClient.audit.mockResolvedValue({ summary: 's', score: 5, findings: [] });

    const created = await request(app).post('/audits').set(headersA).send({ categoryId, recordingId });

    const ownGet = await request(app).get(`/audits/${created.body._id}`).set(headersA);
    expect(ownGet.status).toBe(200);

    const otherGet = await request(app).get(`/audits/${created.body._id}`).set(headersB);
    expect(otherGet.status).toBe(404);
  });
});
