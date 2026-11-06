// Fakes only the network boundary (Supabase REST calls) so storage.js's real
// validation logic (extension/magic-byte/size checks) still runs in full.
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
  // GET (download)
  const body = uploadedBodies.get(key);
  if (body === undefined) {
    return {
      ok: false,
      status: 400,
      text: async () => '{"statusCode":"404","error":"not_found"}',
    };
  }
  return { ok: true, status: 200, arrayBuffer: async () => body };
});

const request = require('supertest');
const app = require('../src/app');
const { connectDb, mongoose } = require('../src/db/connection');
const User = require('../src/models/user');
const Recording = require('../src/models/recording');

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
  await User.deleteMany({});
  await Recording.deleteMany({});
});

afterAll(async () => {
  await mongoose.disconnect();
});

describe('POST /recordings', () => {
  it('uploads a valid small file and returns 201', async () => {
    const headers = await registerAndLogin('rec@example.com');
    const response = await request(app)
      .post('/recordings')
      .set(headers)
      .attach('file', Buffer.concat([MP3_HEADER, Buffer.from('audio')]), 'call.mp3');

    expect(response.status).toBe(201);
    expect(response.body.status).toBe('uploaded');
  });

  it('rejects a type-spoofed file with 422', async () => {
    const headers = await registerAndLogin('spoof@example.com');
    const response = await request(app)
      .post('/recordings')
      .set(headers)
      .attach('file', Buffer.from('not actually audio'), 'call.mp3');

    expect(response.status).toBe(422);
  });
});

describe('GET /recordings and /recordings/:id', () => {
  it('lists and retrieves only the owner\'s own recordings', async () => {
    const headersA = await registerAndLogin('recget-a@example.com');
    const headersB = await registerAndLogin('recget-b@example.com');

    const uploaded = await request(app)
      .post('/recordings')
      .set(headersA)
      .attach('file', Buffer.concat([MP3_HEADER, Buffer.from('audio')]), 'call.mp3');

    const listB = await request(app).get('/recordings').set(headersB);
    expect(listB.body.length).toBe(0);

    const getOther = await request(app).get(`/recordings/${uploaded.body._id}`).set(headersB);
    expect(getOther.status).toBe(404);

    const getOwn = await request(app).get(`/recordings/${uploaded.body._id}`).set(headersA);
    expect(getOwn.status).toBe(200);
  });
});

describe('GET /recordings/:id/download', () => {
  it('returns the exact uploaded bytes for the owner, 404 for others', async () => {
    const headersA = await registerAndLogin('recdl-a@example.com');
    const headersB = await registerAndLogin('recdl-b@example.com');
    const body = Buffer.concat([MP3_HEADER, Buffer.from('exact bytes to compare')]);

    const uploaded = await request(app).post('/recordings').set(headersA).attach('file', body, 'call.mp3');

    const ownDownload = await request(app).get(`/recordings/${uploaded.body._id}/download`).set(headersA);
    expect(ownDownload.status).toBe(200);
    expect(Buffer.compare(ownDownload.body, body)).toBe(0);

    const otherDownload = await request(app).get(`/recordings/${uploaded.body._id}/download`).set(headersB);
    expect(otherDownload.status).toBe(404);
  });
});

describe('daily retention cleanup', () => {
  it('deletes a user\'s own recordings from previous days on new upload', async () => {
    const headers = await registerAndLogin('cleanup@example.com');
    const me = await request(app).get('/auth/me').set(headers);

    const stale = await Recording.create({
      ownerId: me.body.id,
      originalFilename: 'old.mp3',
      storageKey: 'old-key.mp3',
      contentType: 'audio/mpeg',
      sizeBytes: 10,
      createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    });

    await request(app)
      .post('/recordings')
      .set(headers)
      .attach('file', Buffer.concat([MP3_HEADER, Buffer.from('audio')]), 'new.mp3');

    const stillThere = await Recording.findById(stale._id);
    expect(stillThere).toBeNull();
  });
});
