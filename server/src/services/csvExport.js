const CSV_HEADERS = ['id', 'recordingId', 'categoryId', 'status', 'score', 'summary', 'createdAt', 'completedAt'];

function escapeCsvField(value) {
  const str = value === null || value === undefined ? '' : String(value);
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/** Builds a CSV string from audit jobs — no library, just comma/quote escaping. */
function buildAuditJobsCsv(jobs) {
  const rows = jobs.map((job) =>
    [
      job._id,
      job.recordingId,
      job.categoryId,
      job.status,
      job.result ? job.result.score : '',
      job.result ? job.result.summary : '',
      job.createdAt ? job.createdAt.toISOString() : '',
      job.completedAt ? job.completedAt.toISOString() : '',
    ]
      .map(escapeCsvField)
      .join(',')
  );
  return [CSV_HEADERS.join(','), ...rows].join('\n');
}

module.exports = { buildAuditJobsCsv };
