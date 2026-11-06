const { connectDb, mongoose } = require('../src/db/connection');
const User = require('../src/models/user');
const { hashPassword, verifyPassword } = require('../src/utils/password');

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

describe('User model', () => {
  it('rejects a duplicate email', async () => {
    await User.create({ email: 'dup@example.com', hashedPassword: 'x' });
    await expect(User.create({ email: 'dup@example.com', hashedPassword: 'y' })).rejects.toThrow(
      /duplicate key/
    );
  });
});

describe('password hashing', () => {
  it('round-trips hash/verify', async () => {
    const hashed = await hashPassword('correct-password');
    expect(hashed).not.toBe('correct-password');
    await expect(verifyPassword('correct-password', hashed)).resolves.toBe(true);
  });

  it('fails verification for the wrong password', async () => {
    const hashed = await hashPassword('correct-password');
    await expect(verifyPassword('wrong-password', hashed)).resolves.toBe(false);
  });
});
