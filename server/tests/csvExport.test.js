const { buildAuditJobsCsv } = require('../src/services/csvExport');

describe('buildAuditJobsCsv', () => {
  it('produces a header row plus one row per job with key fields present', () => {
    const csv = buildAuditJobsCsv([
      {
        _id: 'job1',
        recordingId: 'rec1',
        categoryId: 'cat1',
        status: 'completed',
        result: { score: 9, summary: 'Great call' },
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        completedAt: new Date('2026-01-01T00:01:00.000Z'),
      },
    ]);

    const [header, row] = csv.split('\n');
    const headerFields = header.split(',');
    const rowFields = row.split(',');

    expect(headerFields).toEqual(['id', 'recordingId', 'categoryId', 'status', 'score', 'summary', 'createdAt', 'completedAt']);
    expect(rowFields.slice(0, 5)).toEqual(['job1', 'rec1', 'cat1', 'completed', '9']);
    expect(row).toContain('Great call');
  });

  it('escapes a comma/quote-containing summary so the row still parses as one field', () => {
    const csv = buildAuditJobsCsv([
      {
        _id: 'job2',
        recordingId: 'rec2',
        categoryId: 'cat2',
        status: 'completed',
        result: { score: 5, summary: 'Said "hello, there"' },
        createdAt: new Date(),
        completedAt: new Date(),
      },
    ]);

    const [, row] = csv.split('\n');
    expect(row).toContain('"Said ""hello, there"""');
    expect(row.split(',').length).toBeGreaterThan(8); // the quoted field itself contains a comma
  });
});
