const { connectDb, mongoose } = require('../src/db/connection');
const AdminAlert = require('../src/models/adminAlert');
const { raiseProviderQuotaAlert } = require('../src/services/adminAlerts');

const TEST_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/call_auditing_test';

beforeAll(async () => {
  await connectDb(TEST_URI);
});

afterEach(async () => {
  await AdminAlert.deleteMany({});
});

afterAll(async () => {
  await mongoose.disconnect();
});

describe('raiseProviderQuotaAlert', () => {
  it('creates one unresolved alert on the first call', async () => {
    await raiseProviderQuotaAlert('Groq out of credits');

    const alerts = await AdminAlert.find({});
    expect(alerts).toHaveLength(1);
    expect(alerts[0].resolved).toBe(false);
    expect(alerts[0].occurrenceCount).toBe(1);
  });

  it('bumps occurrenceCount on a second call before resolution, without creating a new document', async () => {
    await raiseProviderQuotaAlert('Groq out of credits');
    await raiseProviderQuotaAlert('Groq out of credits');

    const alerts = await AdminAlert.find({});
    expect(alerts).toHaveLength(1);
    expect(alerts[0].occurrenceCount).toBe(2);
  });

  it('creates a fresh alert (new incident) after the prior one is resolved', async () => {
    await raiseProviderQuotaAlert('Groq out of credits');
    await AdminAlert.updateMany({}, { resolved: true, resolvedAt: new Date() });

    await raiseProviderQuotaAlert('Groq out of credits again');

    const alerts = await AdminAlert.find({});
    expect(alerts).toHaveLength(2);
    expect(alerts[1].resolved).toBe(false);
    expect(alerts[1].occurrenceCount).toBe(1);
  });
});
