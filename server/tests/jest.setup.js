require('dotenv').config();

/**
 * Tests delete entire collections in afterEach/afterAll — that's correct
 * test hygiene, but only against an isolated database. .env's MONGODB_URI
 * points at the real app's database, and loading it here as-is let a full
 * test run wipe real data. Force every test run onto a dedicated
 * `..._test` database on the same cluster, no matter what .env says.
 */
function toTestUri(uri) {
  if (!uri) {
    throw new Error('MONGODB_URI is not set — tests have nothing to redirect to a test database.');
  }
  if (/\/[^/?]+(\?|$)/.test(uri)) {
    return uri.replace(/\/[^/?]+(\?|$)/, '/call_auditing_test$1');
  }
  return uri.includes('?') ? uri.replace('?', '/call_auditing_test?') : `${uri}/call_auditing_test`;
}

process.env.MONGODB_URI = toTestUri(process.env.MONGODB_URI);
const dbName = process.env.MONGODB_URI.match(/\/([^/?]+)(\?|$)/)[1];
// eslint-disable-next-line no-console
console.log(`[tests] MONGODB_URI redirected to database: ${dbName}`);
