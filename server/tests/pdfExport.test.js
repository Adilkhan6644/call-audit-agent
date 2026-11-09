const { buildAuditJobsPdf } = require('../src/services/pdfExport');

describe('buildAuditJobsPdf', () => {
  it('produces a non-empty valid PDF buffer', async () => {
    const pdf = await buildAuditJobsPdf([
      { _id: 'job1', status: 'completed', result: { score: 9, summary: 'Great call' }, createdAt: new Date() },
    ]);

    expect(pdf.length).toBeGreaterThan(0);
    expect(pdf.subarray(0, 4).toString('latin1')).toBe('%PDF');
  });
});
