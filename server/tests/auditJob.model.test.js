const mongoose = require('mongoose');
const { connectDb } = require('../src/db/connection');
const AuditJob = require('../src/models/auditJob');
const AuditInstruction = require('../src/models/auditInstruction');

const TEST_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/call_auditing_test';

beforeAll(async () => {
  await connectDb(TEST_URI);
});

afterEach(async () => {
  await AuditJob.deleteMany({});
  await AuditInstruction.deleteMany({});
});

afterAll(async () => {
  await mongoose.disconnect();
});

function fakeId() {
  return new mongoose.Types.ObjectId();
}

describe('AuditJob status', () => {
  it('only accepts a valid status value', async () => {
    const job = new AuditJob({
      recordingId: fakeId(),
      instructionId: fakeId(),
      categoryId: fakeId(),
      ownerId: fakeId(),
      status: 'bogus',
    });
    await expect(job.validate()).rejects.toThrow();
  });

  it('defaults to pending and transitions through processing to completed', async () => {
    const job = await AuditJob.create({
      recordingId: fakeId(),
      instructionId: fakeId(),
      categoryId: fakeId(),
      ownerId: fakeId(),
    });
    expect(job.status).toBe('pending');

    job.status = 'processing';
    await job.save();
    job.status = 'completed';
    job.completedAt = new Date();
    await job.save();

    const reloaded = await AuditJob.findById(job._id);
    expect(reloaded.status).toBe('completed');
    expect(reloaded.completedAt).not.toBeNull();
  });
});

describe('instructionId pinning', () => {
  it('keeps pointing at the version active when the job was created, even after a newer version exists', async () => {
    const categoryId = fakeId();
    const ownerId = fakeId();

    const v1 = await AuditInstruction.create({ categoryId, ownerId, version: 1, content: 'v1 content', isActive: true });
    const job = await AuditJob.create({
      recordingId: fakeId(),
      instructionId: v1._id,
      categoryId,
      ownerId,
    });

    v1.isActive = false;
    await v1.save();
    await AuditInstruction.create({ categoryId, ownerId, version: 2, content: 'v2 content', isActive: true });

    const reloaded = await AuditJob.findById(job._id);
    const pinnedInstruction = await AuditInstruction.findById(reloaded.instructionId);
    expect(pinnedInstruction.version).toBe(1);
    expect(pinnedInstruction.content).toBe('v1 content');
  });
});
