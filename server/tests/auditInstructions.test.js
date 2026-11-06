const request = require('supertest');
const app = require('../src/app');
const { connectDb, mongoose } = require('../src/db/connection');
const User = require('../src/models/user');
const Category = require('../src/models/category');
const AuditInstruction = require('../src/models/auditInstruction');

const TEST_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/call_auditing_test';

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
  await Category.deleteMany({});
  await AuditInstruction.deleteMany({});
});

afterAll(async () => {
  await mongoose.disconnect();
});

describe('audit instruction versioning', () => {
  it('creates v1 then v2, keeps v1 retrievable, and active-version returns only the latest', async () => {
    const headers = await registerAndLogin('instr@example.com');
    const category = await request(app).post('/categories').set(headers).send({ name: 'C1' });
    const categoryId = category.body._id;

    const v1 = await request(app)
      .post('/audit-instructions')
      .set(headers)
      .send({ categoryId, content: 'v1 content' });
    const v2 = await request(app)
      .post('/audit-instructions')
      .set(headers)
      .send({ categoryId, content: 'v2 content' });

    expect(v1.body.version).toBe(1);
    expect(v2.body.version).toBe(2);

    const list = await request(app).get('/audit-instructions').query({ categoryId }).set(headers);
    expect(list.body.map((i) => i.version)).toEqual([1, 2]);
    expect(list.body.find((i) => i.version === 1).content).toBe('v1 content');

    const active = await request(app).get('/audit-instructions/active').query({ categoryId }).set(headers);
    expect(active.body.version).toBe(2);
    expect(active.body.content).toBe('v2 content');
  });
});

describe('cross-category isolation', () => {
  it('never leaks category A instructions into category B results', async () => {
    const headers = await registerAndLogin('isolation@example.com');
    const catA = await request(app).post('/categories').set(headers).send({ name: 'A' });
    const catB = await request(app).post('/categories').set(headers).send({ name: 'B' });

    await request(app)
      .post('/audit-instructions')
      .set(headers)
      .send({ categoryId: catA.body._id, content: 'A-only content' });

    const listB = await request(app)
      .get('/audit-instructions')
      .query({ categoryId: catB.body._id })
      .set(headers);

    expect(listB.body.length).toBe(0);
    expect(JSON.stringify(listB.body)).not.toContain('A-only content');
  });
});
